import prisma from '../../lib/prisma';

export class BranchFeePeriodServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BRANCH_FEE_PERIOD_ERROR',
  ) {
    super(message);
    this.name = 'BranchFeePeriodServiceError';
  }
}

class BranchFeePeriodService {
  /**
   * Lists every BranchCalendar period for the fee's branch + academic year,
   * annotated with which of them are currently assigned to this fee — enough
   * for a checkbox-list UI ("assign one or more periods to this fee").
   */
  async listForFee(branchFeeId: string, academicYearId: string) {
    const fee = await prisma.branchFee.findUnique({ where: { id: branchFeeId } });
    if (!fee) {
      throw new BranchFeePeriodServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    const [periods, assignments] = await Promise.all([
      prisma.branchCalendar.findMany({
        where: { branchId: fee.branchId, academicYearId },
        orderBy: { periodStart: 'asc' },
      }),
      prisma.branchFeePeriod.findMany({
        where: {
          branchFeeId,
          branchCalendar: { academicYearId },
        },
        select: { branchCalendarId: true },
      }),
    ]);

    const assignedIds = new Set(assignments.map((a) => a.branchCalendarId));

    return {
      periods: periods.map((p) => ({ ...p, isAssigned: assignedIds.has(p.id) })),
    };
  }

  /**
   * Replaces this fee's period assignments for one academic year: removes
   * assignments to periods of that year no longer selected, and creates
   * assignments for newly-selected ones. Periods from other academic years
   * are left untouched.
   */
  async setAssignments(branchFeeId: string, academicYearId: string, periodIds: string[]) {
    const fee = await prisma.branchFee.findUnique({ where: { id: branchFeeId } });
    if (!fee) {
      throw new BranchFeePeriodServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    // Validate every requested period belongs to the fee's branch + the given year
    const validPeriods = await prisma.branchCalendar.findMany({
      where: { id: { in: periodIds }, branchId: fee.branchId, academicYearId },
      select: { id: true },
    });

    if (validPeriods.length !== periodIds.length) {
      throw new BranchFeePeriodServiceError(
        'One or more selected periods do not belong to this fee\'s branch and academic year',
        400,
        'VALIDATION_ERROR',
      );
    }

    await prisma.$transaction(async (tx) => {
      // Remove existing assignments to periods of this academic year
      await tx.branchFeePeriod.deleteMany({
        where: {
          branchFeeId,
          branchCalendar: { academicYearId },
        },
      });

      if (periodIds.length > 0) {
        await tx.branchFeePeriod.createMany({
          data: periodIds.map((branchCalendarId) => ({ branchFeeId, branchCalendarId })),
        });
      }
    });

    return this.listForFee(branchFeeId, academicYearId);
  }
}

export const branchFeePeriodService = new BranchFeePeriodService();
