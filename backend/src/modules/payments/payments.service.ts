import { Prisma, Language } from '@prisma/client';
import prisma from '../../lib/prisma';
import { generateReceiptNumber } from './receipt-number.util';
import { derivePeriodStatus } from './billing-period.service';
import type { RecordPaymentInput } from './payments.types';

/**
 * Why a payment was refused, for the client to explain it (e.g. a payment
 * entered offline that can't be saved as is once sent).
 */
export type PaymentRefusalReason =
  | 'child_not_enrolled'
  | 'future_date'
  | 'period_not_found'
  | 'period_cancelled'
  | 'exceeds_outstanding';

export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'VALIDATION_ERROR',
    public reason?: PaymentRefusalReason,
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

/** Unpaid échéances of the branch's children, for recording payments offline. */
export interface OfflinePaymentsSnapshot {
  generatedAt: string;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    periods: Array<{
      id: string;
      /** Dates as YYYY-MM-DD: the snapshot is kept small for slow connections. */
      periodStart: string;
      periodEnd: string;
      dueDate: string;
      amountDue: string;
      baseAmount: string | null;
      isRegistrationPeriod: boolean;
      branchFeeName: string | null;
      isLate: boolean;
      outstanding: string;
    }>;
  }>;
}

class PaymentService {
  /**
   * Record a payment with allocations in a single transaction.
   *
   * Validates all business rules before persisting:
   * - Child exists with at least one enrollment
   * - valueDate <= today
   * - Channel-specific reference_note requirement (ccp/baridimob)
   * - Allocation sum equals totalAmount
   * - Each allocation amount >= 0.01
   * - No duplicate billingPeriodIds
   * - All periods belong to the child (via enrollment)
   * - No cancelled periods
   * - recordedBy resolves to an existing Staff user
   *
   * Requirements: 9.1-9.16, 10.1-10.7, 11.4, 11.14
   */
  async recordPayment(
    input: RecordPaymentInput,
    branchId: string,
  ) {
    const { childId, clientId } = input;

    // Sent again (e.g. a payment entered offline whose first send lost its
    // answer): it's already saved, return it instead of recording it twice.
    if (clientId) {
      const existing = await this.findByClientId(clientId, childId);
      if (existing) return existing;
    }

    try {
      return await this.recordPaymentTransaction(input, branchId);
    } catch (error) {
      // Two sends of the same payment at once: the other one saved it.
      if (
        clientId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target ?? '').includes('client_id')
      ) {
        const existing = await this.findByClientId(clientId, childId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async findByClientId(clientId: string, childId: string) {
    const existing = await prisma.paymentRecord.findUnique({
      where: { clientId },
      include: { allocations: true },
    });
    if (existing && existing.childId !== childId) {
      throw new PaymentServiceError('This client ID belongs to another payment', 409, 'CONFLICT');
    }
    return existing;
  }

  private async recordPaymentTransaction(input: RecordPaymentInput, branchId: string) {
    const {
      childId,
      totalAmount,
      channel,
      valueDate,
      recordedBy,
      referenceNote,
      allocations,
      clientId,
    } = input;

    return await prisma.$transaction(async (tx) => {
      // (a) Validate child exists with at least one billing enrollment.
      // (`paymentEnrollments` — not `enrollments`, which are classroom
      // placements: a child billed but not placed in a class can still pay.)
      const child = await tx.child.findUnique({
        where: { id: childId },
        include: {
          paymentEnrollments: {
            select: { id: true },
          },
        },
      });

      if (!child || child.paymentEnrollments.length === 0) {
        throw new PaymentServiceError(
          'Target child not found or has no enrollments',
          404,
          'NOT_FOUND',
          'child_not_enrolled',
        );
      }

      // (b) Validate valueDate <= today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const valueDateNormalized = new Date(valueDate);
      valueDateNormalized.setHours(0, 0, 0, 0);

      if (valueDateNormalized > today) {
        throw new PaymentServiceError(
          'Value date cannot be in the future',
          400,
          'VALIDATION_ERROR',
          'future_date',
        );
      }

      // (c) Validate channel-specific reference_note requirement
      if (channel === 'ccp' || channel === 'baridimob') {
        const trimmedNote = referenceNote?.trim() ?? '';
        if (trimmedNote.length < 1 || trimmedNote.length > 500) {
          throw new PaymentServiceError(
            'reference_note is required for ccp/baridimob channels (1-500 characters after trim)',
            400,
            'VALIDATION_ERROR',
          );
        }
      }

      // For cash channel, reference_note is optional but max 500 chars if provided
      if (channel === 'cash' && referenceNote) {
        if (referenceNote.length > 500) {
          throw new PaymentServiceError(
            'reference_note must be at most 500 characters',
            400,
            'VALIDATION_ERROR',
          );
        }
      }

      // (d) Validate allocations

      // d.1 Each allocation amount >= 0.01
      for (const alloc of allocations) {
        if (alloc.amount.lt(new Prisma.Decimal('0.01'))) {
          throw new PaymentServiceError(
            `Each allocation amount must be at least 0.01 DZD. Period ${alloc.billingPeriodId} has amount ${alloc.amount.toString()}`,
            400,
            'VALIDATION_ERROR',
          );
        }
      }

      // d.2 Sum of allocation amounts must equal totalAmount
      const allocationSum = allocations.reduce(
        (sum, a) => sum.add(a.amount),
        new Prisma.Decimal('0'),
      );

      if (!allocationSum.equals(totalAmount)) {
        throw new PaymentServiceError(
          `Allocation sum (${allocationSum.toString()}) does not equal total amount (${totalAmount.toString()})`,
          400,
          'VALIDATION_ERROR',
        );
      }

      // d.3 No duplicate billingPeriodIds
      const periodIds = allocations.map((a) => a.billingPeriodId);
      const uniquePeriodIds = new Set(periodIds);
      if (uniquePeriodIds.size !== periodIds.length) {
        const duplicates = periodIds.filter(
          (id, index) => periodIds.indexOf(id) !== index,
        );
        const uniqueDuplicates = Array.from(new Set(duplicates));
        throw new PaymentServiceError(
          `Duplicate billing period IDs in allocations: ${uniqueDuplicates.join(', ')}`,
          400,
          'VALIDATION_ERROR',
        );
      }

      // d.4 All periods must belong to child (via enrollment) and not be cancelled
      const periodIdArray = Array.from(uniquePeriodIds);
      const periods = await tx.billingPeriod.findMany({
        where: {
          id: { in: periodIdArray },
        },
        include: {
          enrollment: {
            select: { childId: true },
          },
        },
      });

      // Check all periods were found
      if (periods.length !== periodIdArray.length) {
        const foundIds = new Set(periods.map((p) => p.id));
        const missing = periodIdArray.filter((id) => !foundIds.has(id));
        throw new PaymentServiceError(
          `Billing period(s) not found: ${missing.join(', ')}`,
          404,
          'NOT_FOUND',
          'period_not_found',
        );
      }

      // Check all periods belong to the child
      for (const period of periods) {
        if (period.enrollment.childId !== childId) {
          throw new PaymentServiceError(
            `Billing period ${period.id} does not belong to the target child`,
            400,
            'VALIDATION_ERROR',
            'period_not_found',
          );
        }
      }

      // d.5 No cancelled periods
      for (const period of periods) {
        if (period.cancelledAt !== null) {
          throw new PaymentServiceError(
            `Billing period ${period.id} is cancelled and cannot receive payments`,
            400,
            'VALIDATION_ERROR',
            'period_cancelled',
          );
        }
      }

      // d.6 Each allocation amount must not exceed the period's outstanding balance
      for (const alloc of allocations) {
        const period = periods.find((p) => p.id === alloc.billingPeriodId);
        if (!period) continue;

        // Calculate total already paid for this period
        const existingAllocations = await tx.paymentAllocation.aggregate({
          where: { billingPeriodId: alloc.billingPeriodId },
          _sum: { amount: true },
        });

        const totalPaid = existingAllocations._sum.amount ?? new Prisma.Decimal('0');
        const outstanding = new Prisma.Decimal(period.amountDue).minus(totalPaid);

        if (alloc.amount.gt(outstanding)) {
          throw new PaymentServiceError(
            `Allocation amount (${alloc.amount.toString()} DZD) exceeds outstanding balance (${outstanding.toString()} DZD) for billing period ${alloc.billingPeriodId}`,
            400,
            'VALIDATION_ERROR',
            'exceeds_outstanding',
          );
        }
      }

      // (e) Validate recordedBy resolves to an existing Staff user
      const recorder = await tx.user.findUnique({
        where: { id: recordedBy },
        select: { id: true, role: true },
      });

      if (!recorder) {
        throw new PaymentServiceError(
          'recorded_by user not found',
          400,
          'VALIDATION_ERROR',
        );
      }

      if (recorder.role !== 'admin' && recorder.role !== 'super_admin') {
        throw new PaymentServiceError(
          'recorded_by must reference a Staff user (admin or super_admin)',
          400,
          'VALIDATION_ERROR',
        );
      }

      // (f) Get branch name for receipt number generation
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true },
      });

      if (!branch) {
        throw new PaymentServiceError(
          'Branch not found',
          404,
          'NOT_FOUND',
        );
      }

      // (g) Generate receipt number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receiptNumber = await generateReceiptNumber(
        tx as any,
        branchId,
        branch.name,
        valueDateNormalized,
      );

      // (h) Create PaymentRecord
      const paymentRecord = await tx.paymentRecord.create({
        data: {
          branchId,
          childId,
          receiptNumber,
          totalAmount,
          channel,
          valueDate: valueDateNormalized,
          recordedBy,
          referenceNote: referenceNote?.trim() || null,
          isCorrection: false,
          correctsPaymentId: null,
          clientId: clientId ?? null,
        },
      });

      // (i) Create PaymentAllocations
      await tx.paymentAllocation.createMany({
        data: allocations.map((alloc) => ({
          paymentRecordId: paymentRecord.id,
          billingPeriodId: alloc.billingPeriodId,
          amount: alloc.amount,
        })),
      });

      // (j) Create PaymentAuditEntry
      await tx.paymentAuditEntry.create({
        data: {
          branchId,
          paymentRecordId: paymentRecord.id,
          action: 'payment_recorded',
          performedBy: recordedBy,
          metadata: {
            childId,
            totalAmount: totalAmount.toString(),
            channel,
            allocationsCount: allocations.length,
          },
        },
      });

      // (k) Return created PaymentRecord with allocations
      const result = await tx.paymentRecord.findUnique({
        where: { id: paymentRecord.id },
        include: {
          allocations: true,
        },
      });

      return result!;
    });
  }

  /**
   * Record a correction/refund against an existing payment.
   *
   * A correction is a new Payment_Record with negative amount, linked to the
   * original payment via corrects_payment_id. The append-only ledger is preserved:
   * no existing record is modified or deleted.
   *
   * Validations inside transaction:
   * - referenceNote required (1-500 chars trimmed)
   * - totalAmount must be < 0
   * - correctsPaymentId resolves to existing non-correction record of same branch
   * - Each allocation amount must be <= 0
   * - Sum of allocations must equal totalAmount
   * - Per-period correction magnitude doesn't exceed original allocation minus prior corrections
   * - recordedBy resolves to existing Staff user
   *
   * Requirements: 11.1-11.18
   */
  async recordCorrection(
    input: {
      childId: string;
      totalAmount: Prisma.Decimal;
      channel: 'cash' | 'ccp' | 'baridimob';
      valueDate: Date;
      recordedBy: string;
      referenceNote: string;
      correctsPaymentId: string;
      allocations: Array<{ billingPeriodId: string; amount: Prisma.Decimal }>;
    },
    branchId: string,
  ) {
    const {
      childId,
      totalAmount,
      channel,
      valueDate,
      recordedBy,
      referenceNote,
      correctsPaymentId,
      allocations,
    } = input;

    return await prisma.$transaction(async (tx) => {
      // (1) Validate referenceNote: required, 1-500 chars after trim
      const trimmedNote = referenceNote?.trim() ?? '';
      if (trimmedNote.length < 1 || trimmedNote.length > 500) {
        throw new PaymentServiceError(
          'reference_note is required for corrections (1-500 characters after trim)',
          400,
          'VALIDATION_ERROR',
        );
      }

      // (2) totalAmount must be < 0
      if (totalAmount.gte(new Prisma.Decimal('0'))) {
        throw new PaymentServiceError(
          'Correction total amount must be negative (less than 0.00 DZD)',
          400,
          'VALIDATION_ERROR',
        );
      }

      // (3) correctsPaymentId must resolve to existing non-correction record of same branch
      const originalPayment = await tx.paymentRecord.findUnique({
        where: { id: correctsPaymentId },
        include: {
          allocations: true,
        },
      });

      if (!originalPayment) {
        throw new PaymentServiceError(
          'corrects_payment_id does not resolve to a stored Payment_Record',
          400,
          'VALIDATION_ERROR',
        );
      }

      if (originalPayment.branchId !== branchId) {
        throw new PaymentServiceError(
          'corrects_payment_id resolves to a Payment_Record of a different branch',
          400,
          'VALIDATION_ERROR',
        );
      }

      if (originalPayment.isCorrection) {
        throw new PaymentServiceError(
          'corrects_payment_id must not reference a Payment_Record that is itself a correction',
          400,
          'VALIDATION_ERROR',
        );
      }

      // (4) Each allocation amount must be <= 0
      for (const alloc of allocations) {
        if (alloc.amount.gt(new Prisma.Decimal('0'))) {
          throw new PaymentServiceError(
            `Each correction allocation amount must be <= 0. Period ${alloc.billingPeriodId} has amount ${alloc.amount.toString()}`,
            400,
            'VALIDATION_ERROR',
          );
        }
      }

      // (5) Sum of allocations must equal totalAmount
      const allocationSum = allocations.reduce(
        (sum, a) => sum.add(a.amount),
        new Prisma.Decimal('0'),
      );

      if (!allocationSum.equals(totalAmount)) {
        throw new PaymentServiceError(
          `Allocation sum (${allocationSum.toString()}) does not equal total amount (${totalAmount.toString()})`,
          400,
          'VALIDATION_ERROR',
        );
      }

      // (6) For each period, absolute correction amount must not exceed original allocation
      //     minus any prior corrections against the same original payment for that period.
      //     i.e., sum of |prior corrections| + |this correction| <= original allocation amount
      const priorCorrections = await tx.paymentAllocation.findMany({
        where: {
          paymentRecord: {
            correctsPaymentId: correctsPaymentId,
            isCorrection: true,
          },
        },
        select: {
          billingPeriodId: true,
          amount: true,
        },
      });

      // Build a map of billingPeriodId -> sum of absolute prior correction amounts
      const priorCorrectionsByPeriod = new Map<string, Prisma.Decimal>();
      for (const pc of priorCorrections) {
        const existing = priorCorrectionsByPeriod.get(pc.billingPeriodId) ?? new Prisma.Decimal('0');
        // Corrections have negative amounts, so take abs
        priorCorrectionsByPeriod.set(
          pc.billingPeriodId,
          existing.add(pc.amount.abs()),
        );
      }

      // Build a map of billingPeriodId -> original allocation amount
      const originalAllocationsByPeriod = new Map<string, Prisma.Decimal>();
      for (const oa of originalPayment.allocations) {
        originalAllocationsByPeriod.set(oa.billingPeriodId, oa.amount);
      }

      for (const alloc of allocations) {
        const originalAllocation = originalAllocationsByPeriod.get(alloc.billingPeriodId);
        if (!originalAllocation) {
          throw new PaymentServiceError(
            `Billing period ${alloc.billingPeriodId} was not allocated by the original payment record`,
            400,
            'VALIDATION_ERROR',
          );
        }

        const priorCorrected = priorCorrectionsByPeriod.get(alloc.billingPeriodId) ?? new Prisma.Decimal('0');
        const thisCorrectionAbs = alloc.amount.abs();
        const totalCorrected = priorCorrected.add(thisCorrectionAbs);

        if (totalCorrected.gt(originalAllocation)) {
          const remaining = originalAllocation.sub(priorCorrected);
          throw new PaymentServiceError(
            `Correction for period ${alloc.billingPeriodId} exceeds correctable amount. Original allocation: ${originalAllocation.toString()}, already corrected: ${priorCorrected.toString()}, remaining: ${remaining.toString()}, requested: ${thisCorrectionAbs.toString()}`,
            422,
            'BUSINESS_RULE_VIOLATION',
          );
        }
      }

      // (7) Validate recordedBy resolves to existing Staff user
      const recorder = await tx.user.findUnique({
        where: { id: recordedBy },
        select: { id: true, role: true },
      });

      if (!recorder) {
        throw new PaymentServiceError(
          'recorded_by user not found',
          400,
          'VALIDATION_ERROR',
        );
      }

      if (recorder.role !== 'admin' && recorder.role !== 'super_admin') {
        throw new PaymentServiceError(
          'recorded_by must reference a Staff user (admin or super_admin)',
          400,
          'VALIDATION_ERROR',
        );
      }

      // (8) Get branch for receipt number generation
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true },
      });

      if (!branch) {
        throw new PaymentServiceError(
          'Branch not found',
          404,
          'NOT_FOUND',
        );
      }

      // (9) Validate valueDate <= today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const valueDateNormalized = new Date(valueDate);
      valueDateNormalized.setHours(0, 0, 0, 0);

      if (valueDateNormalized > today) {
        throw new PaymentServiceError(
          'Value date cannot be in the future',
          400,
          'VALIDATION_ERROR',
        );
      }

      // (10) Generate receipt number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receiptNumber = await generateReceiptNumber(
        tx as any,
        branchId,
        branch.name,
        valueDateNormalized,
      );

      // (11) Create correction PaymentRecord
      const correctionRecord = await tx.paymentRecord.create({
        data: {
          branchId,
          childId,
          receiptNumber,
          totalAmount,
          channel,
          valueDate: valueDateNormalized,
          recordedBy,
          referenceNote: trimmedNote,
          isCorrection: true,
          correctsPaymentId,
        },
      });

      // (12) Create PaymentAllocations (negative amounts)
      await tx.paymentAllocation.createMany({
        data: allocations.map((alloc) => ({
          paymentRecordId: correctionRecord.id,
          billingPeriodId: alloc.billingPeriodId,
          amount: alloc.amount,
        })),
      });

      // (13) Create PaymentAuditEntry
      await tx.paymentAuditEntry.create({
        data: {
          branchId,
          paymentRecordId: correctionRecord.id,
          action: 'correction_recorded',
          performedBy: recordedBy,
          metadata: {
            childId,
            totalAmount: totalAmount.toString(),
            channel,
            correctsPaymentId,
            allocationsCount: allocations.length,
            referenceNote: trimmedNote,
          },
        },
      });

      // (14) Return created correction record with allocations
      const result = await tx.paymentRecord.findUnique({
        where: { id: correctionRecord.id },
        include: {
          allocations: true,
        },
      });

      return result!;
    });
  }

  /**
   * Calculate the outstanding balance for a child.
   *
   * Outstanding Balance = sum(amount_due) over non-cancelled periods
   *                     - sum(allocation amounts) over those same periods
   *
   * Includes all enrollments, all academic years, all branches, including
   * registration periods. Correction allocations (negative) reduce total_paid.
   * Half-up rounding to 2 decimal places is applied only on the final result.
   * A negative result (overpayment) is returned without clamping.
   * Returns 0.00 DZD if no non-cancelled periods exist.
   *
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
   */
  /**
   * Everything needed to record payments without a connection: the branch's
   * billed children and their unpaid échéances (outstanding amount included).
   * Children without unpaid échéances are listed too, with none.
   */
  async getOfflineSnapshot(branchId: string): Promise<OfflinePaymentsSnapshot> {
    const enrollments = await prisma.enrollment.findMany({
      // Deleted children (in the trash) aren't offered.
      where: { branchId, child: { deletedAt: null } },
      select: {
        child: { select: { id: true, firstName: true, lastName: true } },
        billingPeriods: {
          where: { cancelledAt: null },
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            dueDate: true,
            graceEndDate: true,
            amountDue: true,
            baseAmount: true,
            isRegistrationPeriod: true,
            cancelledAt: true,
            branchFee: { select: { name: true } },
            paymentAllocations: { select: { amount: true } },
          },
          orderBy: { periodStart: 'asc' },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const byChild = new Map<string, OfflinePaymentsSnapshot['children'][number]>();
    for (const enrollment of enrollments) {
      const entry = byChild.get(enrollment.child.id) ?? { ...enrollment.child, periods: [] };
      byChild.set(enrollment.child.id, entry);
      for (const period of enrollment.billingPeriods) {
        const paid = period.paymentAllocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
        const derived = derivePeriodStatus(period.amountDue, paid, period.graceEndDate, today, period.cancelledAt);
        if (new Prisma.Decimal(derived.outstanding).lte(0)) continue;
        entry.periods.push({
          id: period.id,
          periodStart: day(period.periodStart),
          periodEnd: day(period.periodEnd),
          dueDate: day(period.dueDate),
          amountDue: period.amountDue.toString(),
          baseAmount: period.baseAmount?.toString() ?? null,
          isRegistrationPeriod: period.isRegistrationPeriod,
          branchFeeName: period.branchFee?.name ?? null,
          isLate: derived.isLate,
          outstanding: new Prisma.Decimal(derived.outstanding).toString(),
        });
      }
    }

    const children = [...byChild.values()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr'),
    );
    return { generatedAt: new Date().toISOString(), children };
  }

  async getOutstandingBalance(childId: string): Promise<Prisma.Decimal> {
    // Validate child exists
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { id: true },
    });

    if (!child) {
      throw new PaymentServiceError(
        'Child not found',
        404,
        'NOT_FOUND',
      );
    }

    // Get all non-cancelled billing periods for this child (across all enrollments)
    const periods = await prisma.billingPeriod.findMany({
      where: {
        enrollment: {
          childId,
        },
        cancelledAt: null,
      },
      select: {
        id: true,
        amountDue: true,
      },
    });

    // If no non-cancelled periods exist, return 0.00
    if (periods.length === 0) {
      return new Prisma.Decimal('0.00');
    }

    // Sum amount_due over all non-cancelled periods (no rounding on intermediate sums)
    const totalDue = periods.reduce(
      (sum, p) => sum.add(p.amountDue),
      new Prisma.Decimal('0'),
    );

    // Get all allocation amounts for those periods (including negative corrections)
    const periodIds = periods.map((p) => p.id);
    const allocations = await prisma.paymentAllocation.findMany({
      where: {
        billingPeriodId: { in: periodIds },
      },
      select: {
        amount: true,
      },
    });

    // Sum all allocation amounts (positive payments + negative corrections)
    const totalPaid = allocations.reduce(
      (sum, a) => sum.add(a.amount),
      new Prisma.Decimal('0'),
    );

    // Balance = totalDue - totalPaid, with half-up rounding to 2 decimal places on final only
    const balance = totalDue.sub(totalPaid);

    // Apply half-up rounding to 2 decimal places using Decimal.toFixed with ROUND_HALF_UP
    // Prisma Decimal uses decimal.js under the hood which supports toDecimalPlaces
    const rounded = new Prisma.Decimal(
      balance.toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
    );

    return rounded;
  }

  /**
   * List payment records for a branch with optional filters.
   *
   * Supports filtering by date range (valueDate) and payment channel.
   * Results are ordered by valueDate descending (most recent first).
   */
  async listRecords(
    branchId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      channel?: string;
      childId?: string;
      /** 'payment' = regular payments, 'correction' = corrections only. */
      type?: 'payment' | 'correction';
      /** Payments with at least one amount allocated to this fee's periods. */
      feeId?: string;
      /** Part of a receipt number (case-insensitive). */
      receipt?: string;
    } = {},
  ) {
    const where: Prisma.PaymentRecordWhereInput = {
      branchId,
    };

    if (filters.childId) where.childId = filters.childId;
    if (filters.type) where.isCorrection = filters.type === 'correction';
    if (filters.feeId) where.allocations = { some: { billingPeriod: { branchFeeId: filters.feeId } } };
    if (filters.receipt) where.receiptNumber = { contains: filters.receipt, mode: 'insensitive' };

    // Date range filter on valueDate
    if (filters.startDate || filters.endDate) {
      where.valueDate = {};
      if (filters.startDate) {
        where.valueDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.valueDate.lte = filters.endDate;
      }
    }

    // Channel filter
    if (filters.channel) {
      where.channel = filters.channel as Prisma.EnumPaymentChannelFilter<'PaymentRecord'>;
    }

    const records = await prisma.paymentRecord.findMany({
      where,
      include: {
        allocations: true,
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        valueDate: 'desc',
      },
    });

    return records;
  }

  /**
   * Late Payments Dashboard: returns all billing periods for a branch where
   * the derived status is 'late' or 'late_partial'.
   *
   * Excludes cancelled periods. Supports optional statusFilter ('late' or 'late_partial').
   * Orders results by grace_end_date ASC, then child name, then period ID.
   *
   * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.8, 14.9
   */
  async getLateDashboard(
    branchId: string,
    statusFilter?: 'late' | 'late_partial',
  ) {
    // Query all non-cancelled billing periods for enrollments of this branch,
    // including payment allocations to compute total_paid.
    const billingPeriods = await prisma.billingPeriod.findMany({
      where: {
        enrollment: {
          branchId,
        },
        cancelledAt: null, // Exclude cancelled periods (Req 14.2)
      },
      include: {
        enrollment: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                // For filtering the dashboard by class.
                enrollments: {
                  select: { classroom: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
        branchFee: { select: { id: true, name: true } },
        paymentAllocations: {
          select: {
            amount: true,
          },
        },
      },
    });

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Derive status for each period and filter to late/late_partial
    const lateEntries: Array<{
      childId: string;
      childName: string;
      classrooms: { id: string; name: string }[];
      /** The fee the period bills; null for a registration period. */
      feeId: string | null;
      feeName: string | null;
      isRegistrationPeriod: boolean;
      periodLabel: string;
      dueDate: Date;
      graceEndDate: Date;
      amountDue: Prisma.Decimal;
      totalPaid: Prisma.Decimal;
      outstanding: Prisma.Decimal;
      status: 'late' | 'late_partial';
      periodId: string;
      /** When the parents were last sent an overdue notice for this period. */
      lastReminderAt: Date | null;
    }> = [];

    for (const period of billingPeriods) {
      // Compute total_paid from allocations
      const totalPaid = period.paymentAllocations.reduce(
        (sum, alloc) => sum.add(alloc.amount),
        new Prisma.Decimal('0'),
      );

      const derived = derivePeriodStatus(
        period.amountDue,
        totalPaid,
        period.graceEndDate,
        currentDate,
        period.cancelledAt,
      );

      // Only include 'late' or 'late_partial' status
      if (derived.status !== 'late' && derived.status !== 'late_partial') {
        continue;
      }

      // Apply optional status filter
      if (statusFilter && derived.status !== statusFilter) {
        continue;
      }

      const child = period.enrollment.child;
      const childName = `${child.firstName} ${child.lastName}`;

      // Build period label (month/year from periodStart)
      const periodDate = new Date(period.periodStart);
      const periodLabel = `${periodDate.getMonth() + 1}/${periodDate.getFullYear()}`;

      lateEntries.push({
        childId: child.id,
        childName,
        classrooms: (child.enrollments ?? []).map((ce) => ce.classroom),
        feeId: period.branchFee?.id ?? null,
        feeName: period.branchFee?.name ?? null,
        isRegistrationPeriod: period.isRegistrationPeriod,
        periodLabel,
        dueDate: period.dueDate,
        graceEndDate: period.graceEndDate,
        amountDue: period.amountDue,
        totalPaid,
        outstanding: derived.outstanding,
        status: derived.status as 'late' | 'late_partial',
        periodId: period.id,
        lastReminderAt: null,
      });
    }

    // Last overdue notice per period (manual reminders and automatic ones),
    // so staff can see who was already chased before sending another.
    if (lateEntries.length > 0) {
      const reminders = await prisma.notification.groupBy({
        by: ['referenceId'],
        where: {
          type: 'payment_overdue',
          referenceId: { in: lateEntries.map((e) => e.periodId) },
        },
        _max: { createdAt: true },
      });
      const lastByPeriod = new Map(reminders.map((r) => [r.referenceId, r._max.createdAt]));
      for (const entry of lateEntries) {
        entry.lastReminderAt = lastByPeriod.get(entry.periodId) ?? null;
      }
    }

    // Sort: grace_end_date ASC, then child name, then period ID (Req 14.9)
    lateEntries.sort((a, b) => {
      const graceCompare = new Date(a.graceEndDate).getTime() - new Date(b.graceEndDate).getTime();
      if (graceCompare !== 0) return graceCompare;

      const nameCompare = a.childName.localeCompare(b.childName);
      if (nameCompare !== 0) return nameCompare;

      return a.periodId.localeCompare(b.periodId);
    });

    return lateEntries;
  }

  /**
   * Remind a late period's parents: push and email to every linked parent,
   * plus SMS to the primary one, naming the fee, the period, what's left to
   * pay and how late it is, in each parent's language.
   *
   * At most one overdue notice per period per day (automatic ones included),
   * so a double click can't send the same SMS twice.
   */
  async sendLateReminder(periodId: string): Promise<{ sentTo: number; sentAt: Date }> {
    const period = await prisma.billingPeriod.findUnique({
      where: { id: periodId },
      include: {
        enrollment: {
          select: {
            child: {
              select: {
                firstName: true,
                lastName: true,
                parentLinks: {
                  select: { isPrimary: true, parent: { select: { id: true, preferredLanguage: true } } },
                },
              },
            },
          },
        },
        branchFee: { select: { name: true } },
        paymentAllocations: { select: { amount: true } },
      },
    });
    if (!period) {
      throw new PaymentServiceError('Billing period not found', 404, 'NOT_FOUND');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalPaid = period.paymentAllocations.reduce(
      (sum, alloc) => sum.add(alloc.amount),
      new Prisma.Decimal('0'),
    );
    const derived = derivePeriodStatus(period.amountDue, totalPaid, period.graceEndDate, today, period.cancelledAt);
    if (derived.status !== 'late' && derived.status !== 'late_partial') {
      throw new PaymentServiceError('This period is not late', 409, 'NOT_LATE');
    }

    const alreadyToday = await prisma.notification.findFirst({
      where: { type: 'payment_overdue', referenceId: periodId, createdAt: { gte: today } },
      select: { id: true },
    });
    if (alreadyToday) {
      throw new PaymentServiceError('The parents were already reminded today', 409, 'ALREADY_REMINDED');
    }

    const child = period.enrollment.child;
    if (child.parentLinks.length === 0) {
      throw new PaymentServiceError('No parent is linked to this child', 422, 'NO_PARENTS');
    }

    const graceEnd = new Date(period.graceEndDate);
    graceEnd.setHours(0, 0, 0, 0);
    const start = new Date(period.periodStart);
    const details = {
      childName: `${child.firstName} ${child.lastName}`,
      feeName: period.isRegistrationPeriod ? null : (period.branchFee?.name ?? null),
      periodLabel: `${start.getMonth() + 1}/${start.getFullYear()}`,
      outstanding: derived.outstanding.toFixed(2),
      daysLate: Math.max(0, Math.floor((today.getTime() - graceEnd.getTime()) / 86_400_000)),
    };

    // Loaded here so importing the payments service doesn't pull in the
    // push/email/SMS clients.
    const { notificationService } = await import('../../services/notification.service');
    await Promise.all(
      child.parentLinks.map(({ isPrimary, parent }) =>
        notificationService.notify({
          userId: parent.id,
          type: 'payment_overdue',
          ...lateReminderMessage(parent.preferredLanguage, details),
          referenceId: periodId,
          referenceType: 'billing_period',
          channels: isPrimary ? ['push', 'email', 'sms'] : ['push', 'email'],
        }),
      ),
    );

    return { sentTo: child.parentLinks.length, sentAt: new Date() };
  }
}

/** A late-payment reminder in the parent's language. */
export function lateReminderMessage(
  language: Language,
  d: { childName: string; feeName: string | null; periodLabel: string; outstanding: string; daysLate: number },
): { title: string; body: string } {
  if (language === 'ar') {
    const fee = d.feeName ?? 'رسوم التسجيل';
    return {
      title: 'تذكير بالدفع',
      body:
        `دفع «${fee}» (${d.periodLabel}) الخاص بـ ${d.childName} متأخر منذ ${d.daysLate} يوم. ` +
        `المبلغ المتبقي: ${d.outstanding} د.ج. يرجى التسوية لدى المدرسة.`,
    };
  }
  const fee = d.feeName ?? "frais d'inscription";
  return {
    title: 'Rappel de paiement',
    body:
      `Le paiement « ${fee} » (${d.periodLabel}) de ${d.childName} est en retard de ` +
      `${d.daysLate} jour${d.daysLate > 1 ? 's' : ''}. Reste à payer : ${d.outstanding} DA. ` +
      `Merci de régulariser auprès de l'école.`,
  };
}

export const paymentService = new PaymentService();
