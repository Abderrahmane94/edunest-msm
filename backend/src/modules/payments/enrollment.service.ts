import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { branchFeeService, BranchFeeServiceError } from './branch-fee.service';
import type { CreateEnrollmentSchemaInput } from './payments.schema';
import type { EnrollmentGenerationResult } from './payments.types';

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
   * Enroll a child for billing in an academic year and apply their fees —
   * every whole-school fee plus the fees picked (`feeIds`) — in one
   * transaction: if any fee fails, nothing is saved. Recurring fees are billed
   * from the enrollment's start date (first period prorated).
   */
  async create(
    input: CreateEnrollmentSchemaInput,
    _userId: string,
  ): Promise<EnrollmentGenerationResult> {
    const { childId, branchId, academicYearId, startDate, feeIds = [] } = input;

    return await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new EnrollmentServiceError('Branch not found', 404, 'NOT_FOUND');
      }

      const academicYear = await tx.academicYear.findUnique({ where: { id: academicYearId } });
      if (!academicYear) {
        throw new EnrollmentServiceError('Academic year not found', 404, 'NOT_FOUND');
      }

      const enrollStart = new Date(startDate);
      const ayStart = new Date(academicYear.startDate);
      const ayEnd = new Date(academicYear.endDate);
      if (enrollStart < ayStart || enrollStart > ayEnd) {
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        throw new EnrollmentServiceError(
          `Start date must be within the academic year range (${formatDate(ayStart)} to ${formatDate(ayEnd)})`,
          400,
          'VALIDATION_ERROR',
        );
      }

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

      // Billing comes from the fees applied below; the enrollment itself
      // carries no fee of its own (legacy columns left at their defaults).
      const enrollment = await tx.enrollment.create({
        data: {
          childId,
          branchId,
          academicYearId,
          baseFeeId: null,
          startDate: enrollStart,
          status: 'active',
          recurringFee: new Prisma.Decimal(0),
        },
      });

      try {
        await branchFeeService.applyFeesToNewEnrollment(tx, { ...enrollment, academicYear }, feeIds);
      } catch (err) {
        if (err instanceof BranchFeeServiceError) {
          throw new EnrollmentServiceError(err.message, err.statusCode, err.code);
        }
        throw err;
      }

      const periods = await tx.billingPeriod.findMany({
        where: { enrollmentId: enrollment.id, cancelledAt: null },
        select: { periodStart: true, periodEnd: true, amountDue: true },
      });

      return {
        enrollmentId: enrollment.id,
        periodsCreated: periods.length,
        earliestPeriodStart: periods.reduce(
          (min, p) => (p.periodStart < min ? p.periodStart : min),
          enrollStart,
        ),
        latestPeriodEnd: periods.reduce((max, p) => (p.periodEnd > max ? p.periodEnd : max), enrollStart),
        totalAmountDue: periods.reduce((sum, p) => sum.add(p.amountDue), new Prisma.Decimal(0)),
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
          include: { branchFee: { select: { id: true, name: true, billingCycle: true } } },
        },
      },
    });

    if (!enrollment) {
      throw new EnrollmentServiceError('Enrollment not found', 404, 'NOT_FOUND');
    }

    return enrollment;
  }

  /**
   * Update an enrollment's status. Amounts come from its fees, not from the
   * enrollment, so already-generated billing periods are never modified here.
   */
  async update(
    id: string,
    data: {
      status?: 'active' | 'withdrawn' | 'completed';
    },
  ) {
    const existing = await prisma.enrollment.findUnique({ where: { id } });

    if (!existing) {
      throw new EnrollmentServiceError('Enrollment not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: data.status !== undefined ? { status: data.status } : {},
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
          data: { amountDue: currentPeriodAmountDue, baseAmount: currentPeriodAmountDue },
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
}

export const enrollmentService = new EnrollmentService();
