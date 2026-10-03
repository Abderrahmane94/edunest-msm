import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type { CreateDiscountInput, UpdateDiscountInput } from './discount.schema';

/** The interactive-transaction client type actually produced by our tenant/soft-delete-extended `prisma`. */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Pure calculation: the discounted amount_due for one billing period, from its
 * pre-discount amount and the discounts that target its fee. Sums the
 * percentage of every discount whose validity window covers the period's
 * start date (capped at 100%) and applies it to the base amount — always the
 * base, never a previously-discounted amount, so repeated recalculation stays
 * idempotent and order-independent.
 */
export function computeDiscountedAmountDue(
  baseAmount: Prisma.Decimal | number,
  periodStart: Date,
  discounts: Array<{ percentage: Prisma.Decimal | number; validFrom: Date; validTo: Date | null }>,
): Prisma.Decimal {
  const applicablePct = discounts
    .filter((d) => d.validFrom <= periodStart && (!d.validTo || d.validTo >= periodStart))
    .reduce((sum, d) => sum + Number(d.percentage), 0);

  const cappedPct = Math.min(applicablePct, 100);
  return new Prisma.Decimal((Number(baseAmount) * (1 - cappedPct / 100)).toFixed(2));
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
      await this.validateTargetFee(tx, enrollmentId, input.branchFeeId);
      const discount = await tx.discount.create({
        data: {
          enrollmentId,
          branchFeeId: input.branchFeeId ?? null,
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
      include: { branchFee: { select: { id: true, name: true } } },
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
      if (input.branchFeeId !== undefined) {
        await this.validateTargetFee(tx, existing.enrollmentId, input.branchFeeId);
      }
      const updated = await tx.discount.update({
        where: { id },
        data: {
          ...(input.branchFeeId !== undefined && { branchFeeId: input.branchFeeId }),
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

  /** A targeted fee must exist in the enrollment's branch and be recurring. */
  private async validateTargetFee(
    tx: TransactionClient,
    enrollmentId: string,
    branchFeeId: string | null | undefined,
  ): Promise<void> {
    if (!branchFeeId) return;
    const [enrollment, fee] = await Promise.all([
      tx.enrollment.findUnique({ where: { id: enrollmentId }, select: { branchId: true } }),
      tx.branchFee.findUnique({ where: { id: branchFeeId }, select: { branchId: true, billingCycle: true } }),
    ]);
    if (!fee || !enrollment || fee.branchId !== enrollment.branchId) {
      throw new DiscountServiceError('Fee not found', 404, 'NOT_FOUND');
    }
    if (!fee.billingCycle) {
      throw new DiscountServiceError(
        'A discount can only target a recurring fee',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  /**
   * Recompute amount_due for the enrollment's recurring-fee periods (monthly
   * or custom cycle; never one-off fees or the registration period) that are
   * not cancelled and have no payment yet. Each period's amount is its
   * pre-discount base_amount reduced by the discounts targeting its fee (or
   * every recurring fee) whose window covers the period's start, capped at
   * 100%. Runs after every discount change and whenever new periods are
   * generated, so new periods pick up existing discounts.
   *
   * Periods with any payment allocation are left untouched (the amount owed is
   * settled once money changed hands), and so is a withdrawn enrollment, whose
   * last period may carry a manually set amount.
   */
  async recalculatePeriods(tx: TransactionClient, enrollmentId: string): Promise<void> {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { status: true },
    });
    if (!enrollment || enrollment.status === 'withdrawn') return;

    const [periods, discounts] = await Promise.all([
      tx.billingPeriod.findMany({
        where: {
          enrollmentId,
          isRegistrationPeriod: false,
          cancelledAt: null,
          branchFee: { billingCycle: { not: null } },
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

      const baseAmount = period.baseAmount ?? period.amountDue;
      const applicable = discounts.filter((d) => !d.branchFeeId || d.branchFeeId === period.branchFeeId);
      const newAmountDue = computeDiscountedAmountDue(baseAmount, new Date(period.periodStart), applicable);

      if (!newAmountDue.equals(period.amountDue) || period.baseAmount === null) {
        await tx.billingPeriod.update({
          where: { id: period.id },
          data: { amountDue: newAmountDue, baseAmount },
        });
      }
    }
  }
}

export const discountService = new DiscountService();
