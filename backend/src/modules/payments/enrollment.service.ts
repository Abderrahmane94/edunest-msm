import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { generatePeriodsForEnrollment } from './billing-period.service';
import type { CreateEnrollmentSchemaInput } from './payments.schema';
import type { EnrollmentGenerationResult } from './payments.types';

/** The interactive-transaction client type actually produced by our tenant/soft-delete-extended `prisma`. */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export class EnrollmentServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'ENROLLMENT_ERROR',
  ) {
    super(message);
    this.name = 'EnrollmentServiceError';
  }
}

class EnrollmentService {
  /**
   * Create an enrollment with transactional billing period generation.
   * The enrollment insert and all billing period inserts are committed
   * as a single atomic unit. On any failure the entire transaction rolls back.
   */
  async create(
    input: CreateEnrollmentSchemaInput,
    _userId: string,
  ): Promise<EnrollmentGenerationResult> {
    const { childId, branchId, academicYearId, startDate, registrationFee } = input;
    let { recurringFee, firstPeriodAmountDue } = input;

    return await prisma.$transaction(async (tx) => {
      // (a) Validate branch exists and has billing config
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        include: { billingConfig: true },
      });

      if (!branch) {
        throw new EnrollmentServiceError('Branch not found', 404, 'NOT_FOUND');
      }

      if (!branch.billingConfig) {
        throw new EnrollmentServiceError(
          'Branch has no billing configuration. Please configure billing before creating enrollments.',
          422,
          'GENERATION_FAILED',
        );
      }

      const config = branch.billingConfig;

      // (b) Validate academic year exists
      const academicYear = await tx.academicYear.findUnique({
        where: { id: academicYearId },
      });

      if (!academicYear) {
        throw new EnrollmentServiceError(
          'Academic year not found',
          404,
          'NOT_FOUND',
        );
      }

      const ayStart = new Date(academicYear.startDate);
      const ayEnd = new Date(academicYear.endDate);
      const enrollStart = new Date(startDate);

      // Validate start_date is within academic year range (Req 3.10)
      if (enrollStart < ayStart || enrollStart > ayEnd) {
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        throw new EnrollmentServiceError(
          `Start date must be within the academic year range (${formatDate(ayStart)} to ${formatDate(ayEnd)})`,
          400,
          'VALIDATION_ERROR',
        );
      }

      // (c) Check unique constraint (childId + academicYearId)
      const existing = await tx.enrollment.findUnique({
        where: { childId_academicYearId: { childId, academicYearId } },
      });

      if (existing) {
        throw new EnrollmentServiceError(
          `An enrollment already exists for this child in the specified academic year (id: ${existing.id})`,
          409,
          'CONFLICT',
        );
      }

      // (d) Default recurring_fee to branch config when not supplied
      if (recurringFee === undefined || recurringFee === null) {
        recurringFee = Number(config.defaultRecurringFee);
      }

      const recurringFeeDecimal = new Prisma.Decimal(recurringFee);

      // (e) Validate firstPeriodAmountDue if provided
      if (firstPeriodAmountDue !== undefined) {
        const firstPeriodDecimal = new Prisma.Decimal(firstPeriodAmountDue);

        // Req 7.8: startDate must be > first period's periodStart
        // For monthly: first period start is first of the month containing startDate
        // For trimester/custom: first period start comes from calendar rows
        // We determine the first period start based on billing cycle
        const firstPeriodStart = this.getFirstPeriodStart(
          enrollStart,
          config.billingCycle as 'monthly' | 'trimester' | 'custom',
          branchId,
          academicYearId,
          tx,
        );

        const resolvedFirstPeriodStart = await firstPeriodStart;

        if (enrollStart.getTime() <= resolvedFirstPeriodStart.getTime()) {
          throw new EnrollmentServiceError(
            'A first-period amount may only be stated when start_date is later than the first billing period start',
            400,
            'VALIDATION_ERROR',
          );
        }

        // Req 7.5-7.6: value must be 0..recurringFee
        if (firstPeriodDecimal.lt(new Prisma.Decimal(0))) {
          throw new EnrollmentServiceError(
            `First period amount_due must be between 0.00 and ${recurringFeeDecimal.toString()} (the recurring fee)`,
            400,
            'VALIDATION_ERROR',
          );
        }

        if (firstPeriodDecimal.gt(recurringFeeDecimal)) {
          throw new EnrollmentServiceError(
            `First period amount_due must be between 0.00 and ${recurringFeeDecimal.toString()} (the recurring fee)`,
            400,
            'VALIDATION_ERROR',
          );
        }
      }

      // (f) Fetch BranchCalendar rows if billingCycle is trimester/custom
      let calendarRows: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }> = [];

      if (config.billingCycle === 'trimester' || config.billingCycle === 'custom') {
        const rows = await tx.branchCalendar.findMany({
          where: { branchId, academicYearId },
          orderBy: { periodStart: 'asc' },
        });

        calendarRows = rows.map((r) => ({
          periodStart: new Date(r.periodStart),
          periodEnd: new Date(r.periodEnd),
          dueDate: new Date(r.dueDate),
        }));
      }

      // (g) Call generatePeriodsForEnrollment with all params
      // We use a placeholder enrollmentId — we'll create the enrollment first to get its ID
      const enrollment = await tx.enrollment.create({
        data: {
          childId,
          branchId,
          academicYearId,
          startDate: enrollStart,
          status: 'active',
          registrationFee: registrationFee !== undefined && registrationFee !== null
            ? new Prisma.Decimal(registrationFee)
            : null,
          recurringFee: recurringFeeDecimal,
        },
      });

      const generationResult = generatePeriodsForEnrollment({
        enrollmentId: enrollment.id,
        startDate: enrollStart,
        academicYearStartDate: ayStart,
        academicYearEndDate: ayEnd,
        billingCycle: config.billingCycle as 'monthly' | 'trimester' | 'custom',
        billingDueDay: config.billingDueDay,
        gracePeriodDays: config.gracePeriodDays,
        recurringFee: recurringFeeDecimal,
        registrationFee: registrationFee !== undefined && registrationFee !== null
          ? new Prisma.Decimal(registrationFee)
          : null,
        firstPeriodAmountDue: firstPeriodAmountDue !== undefined
          ? new Prisma.Decimal(firstPeriodAmountDue)
          : undefined,
        calendarRows,
      });

      // (i) Insert all generated billing periods
      if (generationResult.periods.length > 0) {
        await tx.billingPeriod.createMany({
          data: generationResult.periods.map((p) => ({
            enrollmentId: p.enrollmentId,
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
            dueDate: p.dueDate,
            graceEndDate: p.graceEndDate,
            amountDue: p.amountDue,
            isRegistrationPeriod: p.isRegistrationPeriod,
            cancelledAt: null,
          })),
        });
      }

      // (j) Return EnrollmentGenerationResult
      return {
        enrollmentId: enrollment.id,
        periodsCreated: generationResult.periodsCreated,
        earliestPeriodStart: generationResult.earliestPeriodStart,
        latestPeriodEnd: generationResult.latestPeriodEnd,
        totalAmountDue: generationResult.totalAmountDue,
      };
    });
  }

  /**
   * List enrollments for a branch, with optional academicYearId filter.
   */
  async list(
    branchId: string,
    filters?: { academicYearId?: string },
  ) {
    const where: Prisma.EnrollmentWhereInput = { branchId };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        child: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return enrollments;
  }

  /**
   * List enrollments across multiple branches (for school-wide staff).
   */
  async listMultipleBranches(
    branchIds: string[],
    filters?: { academicYearId?: string },
  ) {
    const where: Prisma.EnrollmentWhereInput = {
      branchId: { in: branchIds },
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        child: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return enrollments;
  }

  /**
   * Get a single enrollment with its billing periods.
   */
  async get(id: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        child: { select: { id: true, firstName: true, lastName: true } },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
        branch: { select: { id: true, name: true } },
        billingPeriods: {
          orderBy: { periodStart: 'asc' },
        },
      },
    });

    if (!enrollment) {
      throw new EnrollmentServiceError('Enrollment not found', 404, 'NOT_FOUND');
    }

    return enrollment;
  }

  /**
   * Update enrollment fields (status, fees).
   * Per Requirement 6, already-generated billing periods are NOT modified.
   */
  async update(
    id: string,
    data: {
      status?: 'active' | 'withdrawn' | 'completed';
      recurringFee?: number;
      registrationFee?: number | null;
    },
  ) {
    const existing = await prisma.enrollment.findUnique({ where: { id } });

    if (!existing) {
      throw new EnrollmentServiceError('Enrollment not found', 404, 'NOT_FOUND');
    }

    const updateData: Prisma.EnrollmentUpdateInput = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.recurringFee !== undefined) {
      updateData.recurringFee = new Prisma.Decimal(data.recurringFee);
    }

    if (data.registrationFee !== undefined) {
      updateData.registrationFee = data.registrationFee !== null
        ? new Prisma.Decimal(data.registrationFee)
        : null;
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: updateData,
    });

    // Count periods left unchanged (Req 6.7)
    const unchangedCount = await prisma.billingPeriod.count({
      where: { enrollmentId: id },
    });

    return { enrollment: updated, unchangedPeriodsCount: unchangedCount };
  }

  /**
   * Withdraw an enrollment: set status to 'withdrawn', record withdrawal date,
   * cancel future billing periods, and optionally adjust the current period's amount_due.
   *
   * All changes happen in a single transaction. On any validation failure the
   * transaction is rolled back and no state is persisted.
   *
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12
   */
  async withdraw(
    id: string,
    data: { withdrawalDate: Date; currentPeriodAmountDue?: number },
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch enrollment with billing periods
      const enrollment = await tx.enrollment.findUnique({
        where: { id },
        include: {
          billingPeriods: {
            orderBy: { periodStart: 'asc' },
          },
        },
      });

      if (!enrollment) {
        throw new EnrollmentServiceError('Enrollment not found', 404, 'NOT_FOUND');
      }

      // 2. Validate enrollment is active
      if (enrollment.status !== 'active') {
        throw new EnrollmentServiceError(
          `Enrollment status must be 'active' to withdraw, current status: '${enrollment.status}'`,
          400,
          'VALIDATION_ERROR',
        );
      }

      const withdrawalDate = new Date(data.withdrawalDate);
      const startDate = new Date(enrollment.startDate);

      // 3. Validate withdrawalDate >= enrollment.startDate
      if (withdrawalDate < startDate) {
        throw new EnrollmentServiceError(
          'Withdrawal date must be on or after the enrollment start date',
          400,
          'VALIDATION_ERROR',
        );
      }

      // 4. Validate withdrawalDate <= latest non-registration period's periodEnd
      const nonRegistrationPeriods = enrollment.billingPeriods.filter(
        (p) => !p.isRegistrationPeriod,
      );

      if (nonRegistrationPeriods.length === 0) {
        throw new EnrollmentServiceError(
          'Enrollment has no recurring billing periods',
          422,
          'VALIDATION_ERROR',
        );
      }

      const latestPeriodEnd = nonRegistrationPeriods.reduce(
        (max, p) => (new Date(p.periodEnd) > max ? new Date(p.periodEnd) : max),
        new Date(nonRegistrationPeriods[0].periodEnd),
      );

      if (withdrawalDate > latestPeriodEnd) {
        throw new EnrollmentServiceError(
          `Withdrawal date must be on or before the latest billing period end date (${latestPeriodEnd.toISOString().split('T')[0]})`,
          400,
          'VALIDATION_ERROR',
        );
      }

      // 5. If currentPeriodAmountDue is provided, find and validate the covering period
      if (data.currentPeriodAmountDue !== undefined) {
        const currentPeriodAmountDue = new Prisma.Decimal(data.currentPeriodAmountDue);

        // Find the period that contains the withdrawal date
        const coveringPeriod = nonRegistrationPeriods.find((p) => {
          const pStart = new Date(p.periodStart);
          const pEnd = new Date(p.periodEnd);
          return pStart <= withdrawalDate && withdrawalDate <= pEnd;
        });

        if (!coveringPeriod) {
          throw new EnrollmentServiceError(
            'No billing period covers the withdrawal date; amount_due adjustment is not applicable',
            400,
            'VALIDATION_ERROR',
          );
        }

        // Validate: 0.00 <= currentPeriodAmountDue <= coveringPeriod.amountDue
        if (currentPeriodAmountDue.lt(new Prisma.Decimal(0))) {
          throw new EnrollmentServiceError(
            `Current period amount_due must be between 0.00 and ${coveringPeriod.amountDue.toString()}`,
            400,
            'VALIDATION_ERROR',
          );
        }

        if (currentPeriodAmountDue.gt(coveringPeriod.amountDue)) {
          throw new EnrollmentServiceError(
            `Current period amount_due must be between 0.00 and ${coveringPeriod.amountDue.toString()}`,
            400,
            'VALIDATION_ERROR',
          );
        }

        // Update the covering period's amount_due
        await tx.billingPeriod.update({
          where: { id: coveringPeriod.id },
          data: { amountDue: currentPeriodAmountDue },
        });
      }

      // 6. Update enrollment: status = 'withdrawn', withdrawalDate
      await tx.enrollment.update({
        where: { id },
        data: {
          status: 'withdrawn',
          withdrawalDate: withdrawalDate,
        },
      });

      // 7. Cancel future periods:
      //    - period_start > withdrawalDate
      //    - is_registration_period = false
      //    - cancelled_at is currently null (leave already-cancelled periods unchanged)
      const now = new Date();
      await tx.billingPeriod.updateMany({
        where: {
          enrollmentId: id,
          periodStart: { gt: withdrawalDate },
          isRegistrationPeriod: false,
          cancelledAt: null,
        },
        data: {
          cancelledAt: now,
        },
      });

      // 8. Return updated enrollment with period info
      const updatedEnrollment = await tx.enrollment.findUnique({
        where: { id },
        include: {
          billingPeriods: {
            orderBy: { periodStart: 'asc' },
          },
        },
      });

      const cancelledCount = updatedEnrollment!.billingPeriods.filter(
        (p) => p.cancelledAt !== null,
      ).length;

      const activePeriodCount = updatedEnrollment!.billingPeriods.filter(
        (p) => p.cancelledAt === null,
      ).length;

      return {
        enrollment: {
          id: updatedEnrollment!.id,
          status: updatedEnrollment!.status,
          withdrawalDate: updatedEnrollment!.withdrawalDate,
        },
        periodsCancelled: cancelledCount,
        periodsActive: activePeriodCount,
        totalPeriods: updatedEnrollment!.billingPeriods.length,
      };
    });
  }

  /**
   * Determine the first recurring period's start date based on billing cycle.
   * Used to validate the firstPeriodAmountDue constraint (Req 7.8).
   *
   * For monthly: uses the later of startDate's month or academic year start month.
   */
  private async getFirstPeriodStart(
    startDate: Date,
    billingCycle: 'monthly' | 'trimester' | 'custom',
    branchId: string,
    academicYearId: string,
    tx: TransactionClient,
  ): Promise<Date> {
    if (billingCycle === 'monthly') {
      // Get academic year start to determine effective start
      const academicYear = await tx.academicYear.findUnique({
        where: { id: academicYearId },
        select: { startDate: true },
      });
      const ayStart = academicYear ? new Date(academicYear.startDate) : startDate;
      const effectiveStart = startDate > ayStart ? startDate : ayStart;
      return new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
    }

    // For trimester/custom, get calendar rows and find the first one
    // whose periodEnd >= startDate
    const rows = await tx.branchCalendar.findMany({
      where: { branchId, academicYearId },
      orderBy: { periodStart: 'asc' },
    });

    const filtered = rows.filter(
      (r) => new Date(r.periodEnd) >= startDate,
    );

    if (filtered.length === 0) {
      throw new EnrollmentServiceError(
        'No billing period could be generated for the submitted start_date. No BranchCalendar rows have period_end on or after the start date.',
        422,
        'GENERATION_FAILED',
      );
    }

    return new Date(filtered[0].periodStart);
  }
}

export const enrollmentService = new EnrollmentService();
