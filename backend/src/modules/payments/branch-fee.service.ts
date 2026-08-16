import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

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
   * Create a new fee configuration for a branch.
   */
  async create(branchId: string, data: { name: string; amount: number }) {
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

    return prisma.branchFee.create({
      data: {
        branchId,
        name: data.name.trim(),
        amount: new Prisma.Decimal(data.amount),
      },
    });
  }

  /**
   * Update a fee configuration.
   */
  async update(id: string, data: { name?: string; amount?: number; isActive?: boolean }) {
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
   * Apply a fee to an enrollment (creates a one-time BillingPeriod).
   * Can be called at enrollment time or after.
   */
  async applyFeeToEnrollment(
    branchFeeId: string,
    enrollmentId: string,
    gracePeriodDays: number = 5,
  ) {
    return await prisma.$transaction(async (tx) => {
      // Validate fee exists and is active
      const fee = await tx.branchFee.findUnique({ where: { id: branchFeeId } });
      if (!fee) {
        throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
      }
      if (!fee.isActive) {
        throw new BranchFeeServiceError('Fee is not active', 400, 'VALIDATION_ERROR');
      }

      // Validate enrollment exists
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { branch: { include: { billingConfig: true } } },
      });
      if (!enrollment) {
        throw new BranchFeeServiceError('Enrollment not found', 404, 'NOT_FOUND');
      }

      // Check fee belongs to the same branch as enrollment
      if (fee.branchId !== enrollment.branchId) {
        throw new BranchFeeServiceError(
          'Fee does not belong to the same branch as the enrollment',
          400,
          'VALIDATION_ERROR',
        );
      }

      // Check if this fee has already been applied to this enrollment
      const existing = await tx.billingPeriod.findFirst({
        where: {
          enrollmentId,
          branchFeeId,
          cancelledAt: null,
        },
      });
      if (existing) {
        throw new BranchFeeServiceError(
          'This fee has already been applied to this enrollment',
          409,
          'CONFLICT',
        );
      }

      // Use branch config grace period if available
      const configGrace = enrollment.branch.billingConfig?.gracePeriodDays ?? gracePeriodDays;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const graceEndDate = new Date(today);
      graceEndDate.setDate(graceEndDate.getDate() + configGrace);

      // Create billing period for this fee
      const billingPeriod = await tx.billingPeriod.create({
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
      // Validate fee exists and is active
      const fee = await tx.branchFee.findUnique({ where: { id: branchFeeId } });
      if (!fee) {
        throw new BranchFeeServiceError('Fee not found', 404, 'NOT_FOUND');
      }
      if (!fee.isActive) {
        throw new BranchFeeServiceError('Fee is not active', 400, 'VALIDATION_ERROR');
      }

      // Get the branch billing config for grace period
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        include: { billingConfig: true },
      });
      const gracePeriodDays = branch?.billingConfig?.gracePeriodDays ?? 5;

      // Resolve target enrollments based on type
      let enrollmentIds: string[] = [];

      if (target.type === 'children' && target.childIds?.length) {
        // Get active enrollments for specific children (any branch in same school)
        const enrollments = await tx.enrollment.findMany({
          where: {
            childId: { in: target.childIds },
            status: 'active',
          },
          select: { id: true },
        });
        enrollmentIds = enrollments.map((e) => e.id);
      } else if (target.type === 'classrooms' && target.classroomIds?.length) {
        // Get children in the specified classrooms, then their active enrollments
        const classroomEnrollments = await tx.classroomEnrollment.findMany({
          where: { classroomId: { in: target.classroomIds } },
          select: { childId: true },
        });
        const childIds = [...new Set(classroomEnrollments.map((ce) => ce.childId))];

        if (childIds.length > 0) {
          const enrollments = await tx.enrollment.findMany({
            where: {
              childId: { in: childIds },
              status: 'active',
            },
            select: { id: true },
          });
          enrollmentIds = enrollments.map((e) => e.id);
        }
      } else if (target.type === 'school') {
        // Get all active enrollments for the school (via branch's schoolId)
        const schoolBranches = await tx.branch.findMany({
          where: { schoolId: branch?.schoolId ?? '' },
          select: { id: true },
        });
        const branchIds = schoolBranches.map((b) => b.id);

        const enrollments = await tx.enrollment.findMany({
          where: {
            branchId: { in: branchIds },
            status: 'active',
          },
          select: { id: true },
        });
        enrollmentIds = enrollments.map((e) => e.id);
      }

      if (enrollmentIds.length === 0) {
        return { applied: 0, skipped: 0, total: 0 };
      }

      // Check which enrollments already have this fee applied
      const existingPeriods = await tx.billingPeriod.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          branchFeeId,
          cancelledAt: null,
        },
        select: { enrollmentId: true },
      });
      const alreadyApplied = new Set(existingPeriods.map((p) => p.enrollmentId));

      // Filter out enrollments that already have the fee
      const toApply = enrollmentIds.filter((id) => !alreadyApplied.has(id));

      if (toApply.length === 0) {
        return { applied: 0, skipped: enrollmentIds.length, total: enrollmentIds.length };
      }

      // Create billing periods for all targeted enrollments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const graceEndDate = new Date(today);
      graceEndDate.setDate(graceEndDate.getDate() + gracePeriodDays);

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

      return {
        applied: toApply.length,
        skipped: alreadyApplied.size,
        total: enrollmentIds.length,
      };
    });
  }
}

export const branchFeeService = new BranchFeeService();
