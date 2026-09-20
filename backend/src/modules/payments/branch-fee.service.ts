import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { generatePeriodsForEnrollment } from './billing-period.service';
import { fetchCalendarRows } from './billing-cycle.util';

type BillingCycle = 'monthly' | 'trimester' | 'custom';

export interface FeeCycleInput {
  billingCycle?: BillingCycle | null;
  billingDueDay?: number | null;
  gracePeriodDays?: number | null;
}

export class BranchFeeServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BRANCH_FEE_ERROR',
  ) {
    super(message);
    this.name = 'BranchFeeServiceError';
  }
}

/**
 * Validates that billingCycle/billingDueDay/gracePeriodDays are either all
 * present (a recurring fee) or all absent (a one-shot fee) — never a mix.
 * Throws on invalid combinations or out-of-range values.
 */
function validateCycleFields(input: FeeCycleInput): void {
  const { billingCycle, billingDueDay, gracePeriodDays } = input;
  const provided = [billingCycle, billingDueDay, gracePeriodDays].filter(
    (v) => v !== undefined && v !== null,
  ).length;

  if (provided === 0) return;

  if (provided < 3) {
    throw new BranchFeeServiceError(
      'billingCycle, billingDueDay, and gracePeriodDays must be provided together for a recurring fee, or all omitted for a one-shot fee',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!['monthly', 'trimester', 'custom'].includes(billingCycle as string)) {
    throw new BranchFeeServiceError(
      'billingCycle must be one of: monthly, trimester, custom',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (
    !Number.isInteger(billingDueDay) ||
    (billingDueDay as number) < 1 ||
    (billingDueDay as number) > 28
  ) {
    throw new BranchFeeServiceError(
      'billingDueDay must be an integer between 1 and 28',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (
    !Number.isInteger(gracePeriodDays) ||
    (gracePeriodDays as number) < 0 ||
    (gracePeriodDays as number) > 60
  ) {
    throw new BranchFeeServiceError(
      'gracePeriodDays must be an integer between 0 and 60',
      400,
      'VALIDATION_ERROR',
    );
  }
}

class BranchFeeService {
  /**
   * List all fees for a branch (optionally filter by isActive).
   */
  async list(branchId: string, onlyActive = true) {
    const where: Prisma.BranchFeeWhereInput = { branchId };
    if (onlyActive) {
      where.isActive = true;
    }

    return prisma.branchFee.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create a new fee configuration for a branch. A fee with billingCycle set
   * is recurring (generates a full cycle of periods when applied); without
   * it, applying the fee charges a single one-shot period immediately.
   */
  async create(
    branchId: string,
    data: { name: string; amount: number } & FeeCycleInput,
  ) {
    // Validate branch exists
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new BranchFeeServiceError('Branch not found', 404, 'NOT_FOUND');
    }

    if (!data.name || data.name.trim().length === 0 || data.name.trim().length > 100) {
      throw new BranchFeeServiceError(
        'Fee name must be between 1 and 100 characters',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (data.amount < 0 || data.amount > 9_999_999.99) {
      throw new BranchFeeServiceError(
        'Fee amount must be between 0.00 and 9,999,999.99 DZD',
        400,
        'VALIDATION_ERROR',
      );
    }

    validateCycleFields(data);

    return prisma.branchFee.create({
      data: {
        branchId,
        name: data.name.trim(),
        amount: new Prisma.Decimal(data.amount),
        billingCycle: data.billingCycle ?? null,
        billingDueDay: data.billingDueDay ?? null,
        gracePeriodDays: data.gracePeriodDays ?? null,
      },
    });
  }

  /**
   * Update a fee configuration.
   */
  async update(
    id: string,
    data: { name?: string; amount?: number; isActive?: boolean } & FeeCycleInput,
  ) {
    const existing = await prisma.branchFee.findUnique({ where: { id } });
    if (!existing) {
      throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    const updateData: Prisma.BranchFeeUpdateInput = {};

    if (data.name !== undefined) {
      if (data.name.trim().length === 0 || data.name.trim().length > 100) {
        throw new BranchFeeServiceError(
          'Fee name must be between 1 and 100 characters',
          400,
          'VALIDATION_ERROR',
        );
      }
      updateData.name = data.name.trim();
    }

    if (data.amount !== undefined) {
      if (data.amount < 0 || data.amount > 9_999_999.99) {
        throw new BranchFeeServiceError(
          'Fee amount must be between 0.00 and 9,999,999.99 DZD',
          400,
          'VALIDATION_ERROR',
        );
      }
      updateData.amount = new Prisma.Decimal(data.amount);
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (
      data.billingCycle !== undefined ||
      data.billingDueDay !== undefined ||
      data.gracePeriodDays !== undefined
    ) {
      const merged: FeeCycleInput = {
        billingCycle:
          data.billingCycle !== undefined ? data.billingCycle : (existing.billingCycle as BillingCycle | null),
        billingDueDay: data.billingDueDay !== undefined ? data.billingDueDay : existing.billingDueDay,
        gracePeriodDays:
          data.gracePeriodDays !== undefined ? data.gracePeriodDays : existing.gracePeriodDays,
      };
      validateCycleFields(merged);
      updateData.billingCycle = merged.billingCycle ?? null;
      updateData.billingDueDay = merged.billingDueDay ?? null;
      updateData.gracePeriodDays = merged.gracePeriodDays ?? null;
    }

    return prisma.branchFee.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete (deactivate) a fee.
   */
  async deactivate(id: string) {
    const existing = await prisma.branchFee.findUnique({ where: { id } });
    if (!existing) {
      throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    return prisma.branchFee.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Apply a fee to an enrollment.
   * - One-shot fee (no billingCycle): creates a single BillingPeriod dated today.
   * - Recurring fee (billingCycle set): generates a full cycle of periods for
   *   the remainder of the enrollment's academic year, exactly like an
   *   enrollment's base fee.
   * Can be called at enrollment time or after.
   */
  async applyFeeToEnrollment(branchFeeId: string, enrollmentId: string) {
    return await prisma.$transaction(async (tx) => {
      const fee = await tx.branchFee.findUnique({ where: { id: branchFeeId } });
      if (!fee) {
        throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
      }
      if (!fee.isActive) {
        throw new BranchFeeServiceError('Fee is not active', 400, 'VALIDATION_ERROR');
      }

      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { academicYear: true },
      });
      if (!enrollment) {
        throw new BranchFeeServiceError('Enrollment not found', 404, 'NOT_FOUND');
      }

      if (fee.branchId !== enrollment.branchId) {
        throw new BranchFeeServiceError(
          'Fee does not belong to the same branch as the enrollment',
          400,
          'VALIDATION_ERROR',
        );
      }

      const existing = await tx.billingPeriod.findFirst({
        where: { enrollmentId, branchFeeId, cancelledAt: null },
      });
      if (existing) {
        throw new BranchFeeServiceError(
          'This fee has already been applied to this enrollment',
          409,
          'CONFLICT',
        );
      }

      if (fee.billingCycle) {
        const periods = await this.generateRecurringFeePeriods(tx, fee, enrollment);
        return {
          periodsCreated: periods.length,
          feeName: fee.name,
          feeAmount: fee.amount,
        };
      }

      const billingPeriod = await this.createOneShotPeriod(tx, fee, enrollmentId);
      return {
        billingPeriod,
        feeName: fee.name,
        feeAmount: fee.amount,
      };
    });
  }

  /**
   * Apply a fee to multiple enrollments in batch.
   * Targets: specific children, specific classrooms, or the whole school.
   * Skips children who already have this fee applied.
   */
  async applyFeeBatch(
    branchFeeId: string,
    branchId: string,
    target: {
      type: 'children' | 'classrooms' | 'school';
      childIds?: string[];
      classroomIds?: string[];
    },
  ) {
    return await prisma.$transaction(async (tx) => {
      const fee = await tx.branchFee.findUnique({ where: { id: branchFeeId } });
      if (!fee) {
        throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
      }
      if (!fee.isActive) {
        throw new BranchFeeServiceError('Fee is not active', 400, 'VALIDATION_ERROR');
      }

      const branch = await tx.branch.findUnique({ where: { id: branchId } });

      // Resolve target enrollments based on type
      let enrollmentIds: string[] = [];

      if (target.type === 'children' && target.childIds?.length) {
        const enrollments = await tx.enrollment.findMany({
          where: { childId: { in: target.childIds }, status: 'active' },
          select: { id: true },
        });
        enrollmentIds = enrollments.map((e) => e.id);
      } else if (target.type === 'classrooms' && target.classroomIds?.length) {
        const classroomEnrollments = await tx.classroomEnrollment.findMany({
          where: { classroomId: { in: target.classroomIds } },
          select: { childId: true },
        });
        const childIds = [...new Set(classroomEnrollments.map((ce) => ce.childId))];

        if (childIds.length > 0) {
          const enrollments = await tx.enrollment.findMany({
            where: { childId: { in: childIds }, status: 'active' },
            select: { id: true },
          });
          enrollmentIds = enrollments.map((e) => e.id);
        }
      } else if (target.type === 'school') {
        const schoolBranches = await tx.branch.findMany({
          where: { schoolId: branch?.schoolId ?? '' },
          select: { id: true },
        });
        const branchIds = schoolBranches.map((b) => b.id);

        const enrollments = await tx.enrollment.findMany({
          where: { branchId: { in: branchIds }, status: 'active' },
          select: { id: true },
        });
        enrollmentIds = enrollments.map((e) => e.id);
      }

      if (enrollmentIds.length === 0) {
        return { applied: 0, skipped: 0, total: 0 };
      }

      // Check which enrollments already have this fee applied
      const existingPeriods = await tx.billingPeriod.findMany({
        where: { enrollmentId: { in: enrollmentIds }, branchFeeId, cancelledAt: null },
        select: { enrollmentId: true },
      });
      const alreadyApplied = new Set(existingPeriods.map((p) => p.enrollmentId));
      const toApply = enrollmentIds.filter((id) => !alreadyApplied.has(id));

      if (toApply.length === 0) {
        return { applied: 0, skipped: alreadyApplied.size, total: enrollmentIds.length };
      }

      if (fee.billingCycle) {
        // Recurring fee: each enrollment may belong to a different academic
        // year/calendar, so generate periods one enrollment at a time.
        const enrollments = await tx.enrollment.findMany({
          where: { id: { in: toApply } },
          include: { academicYear: true },
        });

        for (const enrollment of enrollments) {
          await this.generateRecurringFeePeriods(tx, fee, enrollment);
        }
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const graceEndDate = new Date(today);
        graceEndDate.setDate(graceEndDate.getDate() + (fee.gracePeriodDays ?? 5));

        await tx.billingPeriod.createMany({
          data: toApply.map((enrollmentId) => ({
            enrollmentId,
            periodStart: today,
            periodEnd: today,
            dueDate: today,
            graceEndDate,
            amountDue: fee.amount,
            isRegistrationPeriod: false,
            branchFeeId: fee.id,
            cancelledAt: null,
          })),
        });
      }

      return {
        applied: toApply.length,
        skipped: alreadyApplied.size,
        total: enrollmentIds.length,
      };
    });
  }

  /**
   * Creates a single one-shot BillingPeriod for a fee with no billing cycle,
   * dated today, using the fee's own grace period (defaulting to 5 days).
   */
  private async createOneShotPeriod(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    fee: { id: string; amount: Prisma.Decimal; gracePeriodDays: number | null },
    enrollmentId: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const graceEndDate = new Date(today);
    graceEndDate.setDate(graceEndDate.getDate() + (fee.gracePeriodDays ?? 5));

    return tx.billingPeriod.create({
      data: {
        enrollmentId,
        periodStart: today,
        periodEnd: today,
        dueDate: today,
        graceEndDate,
        amountDue: fee.amount,
        isRegistrationPeriod: false,
        branchFeeId: fee.id,
        cancelledAt: null,
      },
    });
  }

  /**
   * Generates and inserts a full cycle of billing periods for a recurring
   * fee applied to an enrollment, starting today through the end of the
   * enrollment's academic year. Reuses the same pure generation function
   * enrollment creation uses.
   */
  private async generateRecurringFeePeriods(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    fee: {
      id: string;
      branchId: string;
      amount: Prisma.Decimal;
      billingCycle: BillingCycle | null;
      billingDueDay: number | null;
      gracePeriodDays: number | null;
    },
    enrollment: { id: string; branchId: string; academicYearId: string; academicYear: { startDate: Date; endDate: Date } },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ayStart = new Date(enrollment.academicYear.startDate);
    const ayEnd = new Date(enrollment.academicYear.endDate);
    const billingCycle = fee.billingCycle as BillingCycle;

    const calendarRows = await fetchCalendarRows(tx, fee.branchId, enrollment.academicYearId, billingCycle);

    let generationResult;
    try {
      generationResult = generatePeriodsForEnrollment({
        enrollmentId: enrollment.id,
        startDate: today > ayStart ? today : ayStart,
        academicYearStartDate: ayStart,
        academicYearEndDate: ayEnd,
        billingCycle,
        billingDueDay: fee.billingDueDay!,
        gracePeriodDays: fee.gracePeriodDays!,
        recurringFee: fee.amount,
        registrationFee: null,
        calendarRows,
      });
    } catch (err) {
      // Surface calendar-configuration failures (e.g. missing/short custom
      // or trimester periods) as a proper 422 instead of a generic 500.
      throw new BranchFeeServiceError(
        err instanceof Error ? err.message : 'Failed to generate billing periods',
        422,
        'GENERATION_FAILED',
      );
    }

    if (generationResult.periods.length > 0) {
      await tx.billingPeriod.createMany({
        data: generationResult.periods.map((p) => ({
          enrollmentId: p.enrollmentId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          dueDate: p.dueDate,
          graceEndDate: p.graceEndDate,
          amountDue: p.amountDue,
          isRegistrationPeriod: false,
          branchFeeId: fee.id,
          cancelledAt: null,
        })),
      });
    }

    return generationResult.periods;
  }
}

export const branchFeeService = new BranchFeeService();
