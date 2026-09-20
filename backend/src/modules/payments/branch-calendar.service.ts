import prisma from '../../lib/prisma';
import type { CreateBranchCalendarInput } from './payments.schema';

export class BranchCalendarServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BRANCH_CALENDAR_ERROR',
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BranchCalendarServiceError';
  }
}

class BranchCalendarService {
  /**
   * Create a new BranchCalendar entry for a fee + academic year.
   * Validates no overlapping date ranges exist within that fee's calendar.
   */
  async create(branchFeeId: string, academicYearId: string, data: CreateBranchCalendarInput) {
    // Verify the fee exists
    const fee = await prisma.branchFee.findFirst({ where: { id: branchFeeId } });
    if (!fee) {
      throw new BranchCalendarServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    // Verify the academic year exists
    const academicYear = await prisma.academicYear.findFirst({ where: { id: academicYearId } });
    if (!academicYear) {
      throw new BranchCalendarServiceError('Academic year not found', 404, 'NOT_FOUND');
    }

    // Check for overlapping date ranges within this fee's calendar
    await this.checkOverlap(branchFeeId, academicYearId, data.period_start, data.period_end);

    const entry = await prisma.branchCalendar.create({
      data: {
        branchId: fee.branchId,
        branchFeeId,
        academicYearId,
        label: data.label,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        dueDate: data.due_date,
      },
    });

    return entry;
  }

  /**
   * Update an existing BranchCalendar entry.
   * Validates ownership and no overlapping date ranges.
   */
  async update(id: string, branchFeeId: string, data: CreateBranchCalendarInput) {
    const existing = await prisma.branchCalendar.findFirst({
      where: { id, branchFeeId },
    });

    if (!existing) {
      throw new BranchCalendarServiceError('Calendar entry not found', 404, 'NOT_FOUND');
    }

    // Check for overlapping date ranges (excluding the current entry)
    await this.checkOverlap(
      existing.branchFeeId,
      existing.academicYearId,
      data.period_start,
      data.period_end,
      id,
    );

    const updated = await prisma.branchCalendar.update({
      where: { id },
      data: {
        label: data.label,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        dueDate: data.due_date,
      },
    });

    return updated;
  }

  /**
   * Delete a BranchCalendar entry.
   * Validates ownership (entry belongs to the specified fee).
   */
  async delete(id: string, branchFeeId: string) {
    const existing = await prisma.branchCalendar.findFirst({
      where: { id, branchFeeId },
    });

    if (!existing) {
      throw new BranchCalendarServiceError('Calendar entry not found', 404, 'NOT_FOUND');
    }

    await prisma.branchCalendar.delete({ where: { id } });
  }

  /**
   * List all BranchCalendar entries for a fee + academic year,
   * ordered by period_start ascending.
   */
  async list(branchFeeId: string, academicYearId: string) {
    const entries = await prisma.branchCalendar.findMany({
      where: { branchFeeId, academicYearId },
      orderBy: { periodStart: 'asc' },
    });

    return entries;
  }

  /**
   * Check if a new/updated date range overlaps with existing entries
   * for the same fee + academic year.
   *
   * Overlap condition: existing.period_start <= new.period_end AND existing.period_end >= new.period_start
   */
  private async checkOverlap(
    branchFeeId: string,
    academicYearId: string,
    periodStart: Date,
    periodEnd: Date,
    excludeId?: string,
  ) {
    const overlapping = await prisma.branchCalendar.findFirst({
      where: {
        branchFeeId,
        academicYearId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });

    if (overlapping) {
      throw new BranchCalendarServiceError(
        'Calendar entry overlaps with existing entry',
        409,
        'CONFLICT',
        { overlappingEntryId: overlapping.id },
      );
    }
  }
}

export const branchCalendarService = new BranchCalendarService();
