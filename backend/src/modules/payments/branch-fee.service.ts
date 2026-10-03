import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { generatePeriodsForEnrollment } from './billing-period.service';
import { fetchCalendarRows } from './billing-cycle.util';

type BillingCycle = 'monthly' | 'custom';

/** The interactive-transaction client type produced by our extended `prisma`. */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Who a fee is for. Exactly one applies at a time: the whole school (applied
 * automatically to every new enrollment), specific classrooms (linked via
 * BranchFeeClassroom), or none (assigned by hand only).
 */
export type FeeScope = 'school' | 'classrooms' | 'none';

export interface ChangeScopeResult {
  dryRun: boolean;
  /** Out-of-scope children holding unpaid charges of this fee. */
  childrenAffected: number;
  /** Unpaid charges of out-of-scope children — cancellable. */
  periodsToCancel: number;
  amountToCancel: string;
  /** Charges of out-of-scope children kept because a payment is allocated to them. */
  paidPeriodsKept: number;
  /** Charges actually cancelled (0 for a dry run or when cancellation wasn't asked). */
  cancelled: number;
}

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

  if (!['monthly', 'custom'].includes(billingCycle as string)) {
    throw new BranchFeeServiceError(
      'billingCycle must be one of: monthly, custom',
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

    const fees = await prisma.branchFee.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        classroomAssignments: {
          include: { classroom: { select: { id: true, name: true } } },
        },
      },
    });

    // Shape classroomAssignments into a plain `classrooms` list (empty = a
    // general fee that applies everywhere; non-empty = scoped to those classes).
    return fees.map(({ classroomAssignments, ...fee }) => ({
      ...fee,
      classrooms: classroomAssignments.map((a) => a.classroom),
    }));
  }

  /**
   * Create a new fee configuration for a branch. A fee with billingCycle set
   * is recurring (generates a full cycle of periods when applied); without
   * it, applying the fee charges a single one-shot period immediately.
   */
  async create(
    branchId: string,
    data: { name: string; amount: number; showInWizard?: boolean } & FeeCycleInput,
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
        showInWizard: data.showInWizard ?? true,
      },
    });
  }

  /**
   * Update a fee configuration.
   */
  async update(
    id: string,
    data: {
      name?: string;
      amount?: number;
      isActive?: boolean;
      appliesToSchool?: boolean;
      showInWizard?: boolean;
    } & FeeCycleInput,
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

    if (data.appliesToSchool !== undefined) {
      updateData.appliesToSchool = data.appliesToSchool;
    }

    if (data.showInWizard !== undefined) {
      updateData.showInWizard = data.showInWizard;
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

    return prisma.$transaction(async (tx) => {
      // A whole-school fee has no classroom links (one scope at a time).
      if (data.appliesToSchool === true) {
        await tx.branchFeeClassroom.deleteMany({ where: { branchFeeId: id } });
      }
      return tx.branchFee.update({
        where: { id },
        data: updateData,
      });
    });
  }

  /**
   * Changes who a fee is for, replacing its whole-school flag and classroom
   * links together so only one scope ever applies. Narrowing to specific
   * classrooms leaves children of other classrooms out of scope: their unpaid
   * charges of this fee for the current school year are reported, and
   * cancelled when `cancelOutOfScope` is set. Charges with a payment allocated
   * are never touched. 'school' covers everyone, and 'none' only stops
   * automatic application, so neither leaves anyone out — charges assigned by
   * hand are kept. With `dryRun`, nothing is changed: the result previews what
   * the change would cancel.
   */
  async changeScope(
    branchFeeId: string,
    input: { scope: FeeScope; classroomIds?: string[]; cancelOutOfScope?: boolean; dryRun?: boolean },
  ): Promise<ChangeScopeResult> {
    if (!['school', 'classrooms', 'none'].includes(input.scope)) {
      throw new BranchFeeServiceError('scope must be one of: school, classrooms, none', 400, 'VALIDATION_ERROR');
    }

    const classroomIds = input.scope === 'classrooms' ? [...new Set(input.classroomIds ?? [])] : [];
    if (input.scope === 'classrooms' && classroomIds.length === 0) {
      throw new BranchFeeServiceError(
        'At least one classroom is required for the "classrooms" scope',
        400,
        'VALIDATION_ERROR',
      );
    }

    return await prisma.$transaction(async (tx) => {
      const fee = await tx.branchFee.findUnique({
        where: { id: branchFeeId },
        include: { branch: { select: { schoolId: true } } },
      });
      if (!fee) {
        throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
      }

      if (classroomIds.length > 0) {
        const valid = await tx.classroom.findMany({
          where: { id: { in: classroomIds }, schoolId: fee.branch.schoolId, deletedAt: null },
          select: { id: true },
        });
        if (valid.length !== classroomIds.length) {
          throw new BranchFeeServiceError(
            "One or more selected classrooms do not belong to this fee's school",
            400,
            'VALIDATION_ERROR',
          );
        }
      }

      let outOfScope: {
        id: string;
        amountDue: Prisma.Decimal;
        enrollment: { childId: string };
        paymentAllocations: { id: string }[];
      }[] = [];
      if (input.scope === 'classrooms') {
        const inScope = await tx.classroomEnrollment.findMany({
          where: { classroomId: { in: classroomIds } },
          select: { childId: true },
        });
        const inScopeChildIds = [...new Set(inScope.map((ce) => ce.childId))];
        // Current school year only: earlier years' charges are settled history.
        outOfScope = await tx.billingPeriod.findMany({
          where: {
            branchFeeId,
            cancelledAt: null,
            enrollment: { childId: { notIn: inScopeChildIds }, academicYear: { isActive: true } },
          },
          select: {
            id: true,
            amountDue: true,
            enrollment: { select: { childId: true } },
            paymentAllocations: { select: { id: true }, take: 1 },
          },
        });
      }

      const cancellable = outOfScope.filter((p) => p.paymentAllocations.length === 0);
      const summary = {
        childrenAffected: new Set(cancellable.map((p) => p.enrollment.childId)).size,
        periodsToCancel: cancellable.length,
        amountToCancel: cancellable
          .reduce((sum, p) => sum.plus(p.amountDue), new Prisma.Decimal(0))
          .toFixed(2),
        paidPeriodsKept: outOfScope.length - cancellable.length,
      };

      if (input.dryRun) {
        return { ...summary, dryRun: true, cancelled: 0 };
      }

      await tx.branchFee.update({
        where: { id: branchFeeId },
        data: { appliesToSchool: input.scope === 'school' },
      });
      await tx.branchFeeClassroom.deleteMany({ where: { branchFeeId } });
      if (classroomIds.length > 0) {
        await tx.branchFeeClassroom.createMany({
          data: classroomIds.map((classroomId) => ({ branchFeeId, classroomId })),
        });
      }

      let cancelled = 0;
      if (input.cancelOutOfScope && cancellable.length > 0) {
        const res = await tx.billingPeriod.updateMany({
          where: {
            id: { in: cancellable.map((p) => p.id) },
            cancelledAt: null,
            paymentAllocations: { none: {} },
          },
          data: { cancelledAt: new Date() },
        });
        cancelled = res.count;
      }

      return { ...summary, dryRun: false, cancelled };
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

      // Classroom links on a whole-school fee would have no effect — it already
      // reaches every classroom. Narrowing it is a scope change (changeScope).
      if (target.type === 'classrooms' && fee.appliesToSchool) {
        throw new BranchFeeServiceError(
          'This fee applies to the whole school. Change its scope to specific classrooms first.',
          409,
          'SCOPE_CONFLICT',
        );
      }

      // Assigning to the whole school also scopes the fee to it, so students
      // enrolled later get it automatically (see applySchoolFeesToEnrollment).
      // One scope at a time: any classroom links are replaced.
      if (target.type === 'school') {
        if (!fee.appliesToSchool) {
          await tx.branchFee.update({ where: { id: fee.id }, data: { appliesToSchool: true } });
        }
        await tx.branchFeeClassroom.deleteMany({ where: { branchFeeId: fee.id } });
      }

      // Likewise, assigning to classrooms links the fee to them, so it shows
      // as one of their fees (and is offered for them in the enrollment wizard).
      if (target.type === 'classrooms' && target.classroomIds?.length) {
        await tx.branchFeeClassroom.createMany({
          data: target.classroomIds.map((classroomId) => ({ branchFeeId: fee.id, classroomId })),
          skipDuplicates: true,
        });
      }

      // Resolve the target children
      let childIds: string[] = [];

      if (target.type === 'children' && target.childIds?.length) {
        childIds = target.childIds;
      } else if (target.type === 'classrooms' && target.classroomIds?.length) {
        const classroomEnrollments = await tx.classroomEnrollment.findMany({
          where: { classroomId: { in: target.classroomIds } },
          select: { childId: true },
        });
        childIds = [...new Set(classroomEnrollments.map((ce) => ce.childId))];
      } else if (target.type === 'school') {
        const children = await tx.child.findMany({
          where: { schoolId: branch?.schoolId ?? '', isActive: true },
          select: { id: true },
        });
        childIds = children.map((c) => c.id);
      }

      if (childIds.length === 0) {
        return { applied: 0, skipped: 0, skippedChildren: [], yearEnded: 0, enrolled: 0, total: 0 };
      }

      // Children not yet enrolled for billing in the current school year get
      // an enrollment created on the fly, so the fee reaches every targeted
      // child — not only those enrolled with a base fee.
      const { enrolled, academicYearId } = await this.enrollChildrenForBilling(tx, childIds, branchId, fee.id);

      // Only the current school year's enrollments: an older enrollment left
      // active must not be charged the fee a second time.
      const enrollments = await tx.enrollment.findMany({
        where: { childId: { in: childIds }, academicYearId, status: 'active' },
        select: { id: true },
      });
      const enrollmentIds = enrollments.map((e) => e.id);

      // Check which enrollments already have this fee applied
      const existingPeriods = await tx.billingPeriod.findMany({
        where: { enrollmentId: { in: enrollmentIds }, branchFeeId, cancelledAt: null },
        select: { enrollmentId: true },
      });
      const alreadyApplied = new Set(existingPeriods.map((p) => p.enrollmentId));
      const toApply = enrollmentIds.filter((id) => !alreadyApplied.has(id));

      // Name the children skipped for already having the fee, so the result
      // says who rather than just how many.
      const skippedChildren =
        alreadyApplied.size > 0
          ? (
              await tx.enrollment.findMany({
                where: { id: { in: [...alreadyApplied] } },
                select: { child: { select: { id: true, firstName: true, lastName: true } } },
              })
            ).map(({ child }) => ({ id: child.id, name: `${child.firstName} ${child.lastName}` }))
          : [];

      if (toApply.length === 0) {
        return {
          applied: 0,
          skipped: alreadyApplied.size,
          skippedChildren,
          yearEnded: 0,
          enrolled,
          total: enrollmentIds.length,
        };
      }

      let applied = toApply.length;

      if (fee.billingCycle) {
        // Recurring fee: each enrollment may belong to a different academic
        // year/calendar, so generate periods one enrollment at a time.
        const enrollments = await tx.enrollment.findMany({
          where: { id: { in: toApply } },
          include: { academicYear: true },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // An enrollment whose academic year has already ended has no
        // remaining periods to bill, so it's skipped rather than failing
        // the whole batch.
        const billable = enrollments.filter((e) => new Date(e.academicYear.endDate) >= today);
        applied = billable.length;

        for (const enrollment of billable) {
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
        applied,
        // Already had this fee.
        skipped: alreadyApplied.size,
        skippedChildren,
        // Academic year already ended — nothing left to bill.
        yearEnded: toApply.length - applied,
        // Enrolled for billing on the fly by this assignment.
        enrolled,
        total: enrollmentIds.length,
      };
    });
  }

  /**
   * Creates a billing enrollment in the school's active academic year for each
   * of the given children who doesn't have one yet. These enrollments have no
   * base fee (nothing billed on their own) and start today, clamped to the
   * academic year. Whole-school fees are applied to them like to any new
   * enrollment. Returns how many children were enrolled, and the year used.
   */
  async enrollChildrenForBilling(
    tx: TransactionClient,
    childIds: string[],
    branchId: string,
    /** Passed through to applySchoolFeesToEnrollment. */
    excludeFeeId?: string,
  ): Promise<{ enrolled: number; academicYearId: string }> {
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    const academicYear = await tx.academicYear.findFirst({
      where: { schoolId: branch?.schoolId ?? '', isActive: true },
    });
    if (!academicYear) {
      throw new BranchFeeServiceError(
        'No active academic year — activate one before assigning fees',
        422,
        'NO_ACTIVE_YEAR',
      );
    }

    const existing = await tx.enrollment.findMany({
      where: { childId: { in: childIds }, academicYearId: academicYear.id },
      select: { childId: true },
    });
    const alreadyEnrolled = new Set(existing.map((e) => e.childId));
    const toEnroll = childIds.filter((id) => !alreadyEnrolled.has(id));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yearStart = new Date(academicYear.startDate);
    const yearEnd = new Date(academicYear.endDate);
    const startDate = today < yearStart ? yearStart : today > yearEnd ? yearEnd : today;

    for (const childId of toEnroll) {
      const enrollment = await tx.enrollment.create({
        data: {
          childId,
          branchId,
          academicYearId: academicYear.id,
          baseFeeId: null,
          startDate,
          status: 'active',
          recurringFee: new Prisma.Decimal(0),
        },
      });
      await this.applySchoolFeesToEnrollment(tx, { ...enrollment, academicYear }, excludeFeeId);
    }

    return { enrolled: toEnroll.length, academicYearId: academicYear.id };
  }

  /**
   * Applies every active whole-school fee to a newly created enrollment,
   * except its base fee (already billed by the enrollment itself). Recurring
   * fees are billed from the enrollment's start date. Runs inside the
   * enrollment-creation transaction.
   */
  async applySchoolFeesToEnrollment(
    tx: TransactionClient,
    enrollment: {
      id: string;
      branchId: string;
      academicYearId: string;
      baseFeeId: string | null;
      startDate: Date;
      academicYear: { startDate: Date; endDate: Date };
    },
    /** A fee the caller is about to apply itself (skipped here to avoid a duplicate). */
    excludeFeeId?: string,
  ) {
    const branch = await tx.branch.findUnique({ where: { id: enrollment.branchId } });
    const skipIds = [enrollment.baseFeeId, excludeFeeId].filter((id): id is string => !!id);
    const fees = await tx.branchFee.findMany({
      where: {
        isActive: true,
        appliesToSchool: true,
        branch: { schoolId: branch?.schoolId ?? '' },
        ...(skipIds.length ? { id: { notIn: skipIds } } : {}),
      },
    });

    for (const fee of fees) {
      try {
        if (fee.billingCycle) {
          await this.generateRecurringFeePeriods(tx, fee, enrollment, enrollment.startDate);
        } else {
          await this.createOneShotPeriod(tx, fee, enrollment.id);
        }
      } catch (err) {
        if (err instanceof BranchFeeServiceError) {
          throw new BranchFeeServiceError(`${fee.name}: ${err.message}`, err.statusCode, err.code);
        }
        throw err;
      }
    }

    return fees.length;
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
    /** Billing starts from this date (default: today), clamped to the academic year start. */
    from?: Date,
  ) {
    const today = from ? new Date(from) : new Date();
    today.setHours(0, 0, 0, 0);

    const ayStart = new Date(enrollment.academicYear.startDate);
    const ayEnd = new Date(enrollment.academicYear.endDate);
    const billingCycle = fee.billingCycle as BillingCycle;

    const calendarRows = await fetchCalendarRows(tx, fee.id, enrollment.academicYearId, billingCycle);

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
      // periods) as a proper 422 instead of a generic 500.
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
