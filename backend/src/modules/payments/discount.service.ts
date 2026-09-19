import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type { CreateDiscountInput, UpdateDiscountInput } from './discount.schema';

/** The interactive-transaction client type actually produced by our tenant/soft-delete-extended `prisma`. */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Pure calculation: the discounted amount_due for one billing period, given
 * the enrollment's base recurring fee and the full list of discounts on the
 * enrollment. Sums the percentage of every discount whose validity window
 * covers the period's start date (capped at 100%) and applies it to the base
 * fee — always the base, never a previously-discounted amount, so repeated
 * recalculation stays idempotent and order-independent.
 */
export function computeDiscountedAmountDue(
  recurringFee: Prisma.Decimal | number,
  periodStart: Date,
  discounts: Array<{ percentage: Prisma.Decimal | number; validFrom: Date; validTo: Date | null }>,
): Prisma.Decimal {
  const applicablePct = discounts
    .filter((d) => d.validFrom <= periodStart && (!d.validTo || d.validTo >= periodStart))
    .reduce((sum, d) => sum + Number(d.percentage), 0);

  const cappedPct = Math.min(applicablePct, 100);
  return new Prisma.Decimal((Number(recurringFee) * (1 - cappedPct / 100)).toFixed(2));
}

export class DiscountServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'DISCOUNT_ERROR',
  ) {
    super(message);
    this.name = 'DiscountServiceError';
  }
}

class DiscountService {
  /**
   * Create a discount for an enrollment and immediately recalculate the
   * amount_due of any not-yet-paid billing periods it applies to.
   */
  async create(enrollmentId: string, input: CreateDiscountInput, createdByUserId: string) {
    this.validateDateRange(input.validFrom, input.validTo);

    return prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          enrollmentId,
          type: input.type,
          percentage: input.percentage,
          description: input.description ?? null,
          validFrom: new Date(input.validFrom),
          validTo: input.validTo ? new Date(input.validTo) : null,
          createdByUserId,
        },
      });

      await this.recalculatePeriods(tx, enrollmentId);

      return discount;
    });
  }

  async listByEnrollment(enrollmentId: string) {
    return prisma.discount.findMany({
      where: { enrollmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEnrollmentIdForDiscount(id: string): Promise<string | null> {
    const discount = await prisma.discount.findUnique({
      where: { id },
      select: { enrollmentId: true },
    });
    return discount?.enrollmentId ?? null;
  }

  async update(id: string, input: UpdateDiscountInput) {
    const existing = await prisma.discount.findUnique({ where: { id } });
    if (!existing) {
      throw new DiscountServiceError('Discount not found', 404, 'NOT_FOUND');
    }

    const validFrom = input.validFrom ?? existing.validFrom.toISOString().split('T')[0];
    const validTo = input.validTo !== undefined
      ? input.validTo
      : (existing.validTo ? existing.validTo.toISOString().split('T')[0] : null);

    this.validateDateRange(validFrom, validTo);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.discount.update({
        where: { id },
        data: {
          ...(input.type !== undefined && { type: input.type }),
          ...(input.percentage !== undefined && { percentage: input.percentage }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.validFrom !== undefined && { validFrom: new Date(input.validFrom) }),
          ...(input.validTo !== undefined && { validTo: input.validTo ? new Date(input.validTo) : null }),
        },
      });

      await this.recalculatePeriods(tx, existing.enrollmentId);

      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.discount.findUnique({ where: { id } });
    if (!existing) {
      throw new DiscountServiceError('Discount not found', 404, 'NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      await tx.discount.delete({ where: { id } });
      await this.recalculatePeriods(tx, existing.enrollmentId);
    });
  }

  private validateDateRange(validFrom: string, validTo?: string | null): void {
    if (validTo && validTo < validFrom) {
      throw new DiscountServiceError(
        'validTo must be on or after validFrom',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  /**
   * Recompute amount_due for the enrollment's recurring, non-cancelled billing
   * periods that have no recorded payment allocations yet, applying the sum of
   * every discount whose validity window covers that period's start date
   * (capped at 100%). Always derives from enrollment.recurringFee — the
   * pre-discount base — never from a period's current (possibly already
   * discounted) amount_due, so repeated edits stay consistent.
   *
   * Periods with any payment allocation are left untouched: once money has
   * changed hands, the amount owed for that period is a settled fact, not
   * something a later discount edit should rewrite.
   */
  private async recalculatePeriods(
    tx: TransactionClient,
    enrollmentId: string,
  ): Promise<void> {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { recurringFee: true, baseFeeId: true },
    });
    if (!enrollment) return;

    const [periods, discounts] = await Promise.all([
      tx.billingPeriod.findMany({
        where: {
          enrollmentId,
          isRegistrationPeriod: false,
          cancelledAt: null,
          // Only the base recurring fee's own periods are discountable — a
          // one-off/extra fee applied on top (a different branchFeeId)
          // should never be swept into a tuition discount.
          OR: [{ branchFeeId: null }, { branchFeeId: enrollment.baseFeeId }],
        },
        include: {
          paymentAllocations: { select: { amount: true } },
        },
      }),
      tx.discount.findMany({ where: { enrollmentId } }),
    ]);

    for (const period of periods) {
      const totalPaid = period.paymentAllocations.reduce(
        (sum, a) => sum.add(a.amount),
        new Prisma.Decimal(0),
      );
      if (!totalPaid.equals(0)) continue;

      const newAmountDue = computeDiscountedAmountDue(
        enrollment.recurringFee,
        new Date(period.periodStart),
        discounts,
      );

      if (!newAmountDue.equals(period.amountDue)) {
        await tx.billingPeriod.update({
          where: { id: period.id },
          data: { amountDue: newAmountDue },
        });
      }
    }
  }
}

export const discountService = new DiscountService();
