import prisma, { type DbClient } from '../../lib/prisma';
import type { CreateAcademicYearInput, UpdateAcademicYearInput } from './academic-years.schema';
import type { AcademicYearResponse } from './academic-years.types';

export class AcademicYearServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AcademicYearServiceError';
  }
}

class AcademicYearsService {
  /**
   * The school year a day counts in: the one containing it; in a gap between
   * two years (summer), the next one; after the last year, the last one.
   * Null when the school has no year. Same rule as migration 0040.
   */
  async yearForDate(schoolId: string, day: Date, db: DbClient = prisma): Promise<string | null> {
    const years = await db.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true },
    });
    const t = day.getTime();
    const containing = years.filter((y) => y.startDate.getTime() <= t && t <= y.endDate.getTime()).at(-1);
    const next = years.find((y) => y.startDate.getTime() > t);
    const last = [...years].reverse().find((y) => y.endDate.getTime() < t);
    return (containing ?? next ?? last)?.id ?? null;
  }

  /**
   * The days a school year covers for dated activity (announcements, events):
   * from the day after the previous year ends — so the summer before it counts
   * in it — to its end, or without end for the last year. Same rule as
   * yearForDate. Null when the year isn't one of this school's.
   */
  async yearWindow(schoolId: string, academicYearId: string): Promise<{ from?: Date; to?: Date } | null> {
    const years = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'asc' },
      select: { id: true, endDate: true },
    });
    const i = years.findIndex((y) => y.id === academicYearId);
    if (i < 0) return null;
    const previous = years[i - 1];
    const isLast = i === years.length - 1;
    const dayAfter = (d: Date) => new Date(d.getTime() + 24 * 60 * 60 * 1000);
    return {
      from: previous ? dayAfter(previous.endDate) : undefined,
      // Up to the end of its last day.
      to: isLast ? undefined : dayAfter(years[i].endDate),
    };
  }

  /**
   * A closed year: one that started before the current (active) year. It can
   * be looked at and its unpaid charges collected, nothing else. Activating it
   * again opens it. No year is closed while none is active.
   */
  async isClosed(schoolId: string, academicYearId: string, db: DbClient = prisma): Promise<boolean> {
    const [year, active] = await Promise.all([
      db.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { startDate: true } }),
      db.academicYear.findFirst({ where: { schoolId, isActive: true }, select: { startDate: true } }),
    ]);
    return !!year && !!active && year.startDate < active.startDate;
  }

  /** A school year id sent by a client, if it is one of this school's. */
  async isSchoolYear(schoolId: string, id: string, db: DbClient = prisma): Promise<boolean> {
    return !!(await db.academicYear.findFirst({ where: { id, schoolId }, select: { id: true } }));
  }

  /**
   * Create a new academic year for a school.
   */
  async create(schoolId: string, input: CreateAcademicYearInput): Promise<AcademicYearResponse> {
    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        isActive: false,
      },
    });

    return academicYear;
  }

  /**
   * List all academic years for a school with pagination.
   */
  async list(
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ academicYears: AcademicYearResponse[]; total: number }> {
    const [academicYears, total] = await Promise.all([
      prisma.academicYear.findMany({
        where: { schoolId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.academicYear.count({ where: { schoolId } }),
    ]);

    return { academicYears, total };
  }

  /**
   * Get a single academic year by ID, scoped to the school.
   */
  async getById(id: string, schoolId: string): Promise<AcademicYearResponse> {
    const academicYear = await prisma.academicYear.findFirst({
      where: { id, schoolId },
    });

    if (!academicYear) {
      throw new AcademicYearServiceError('Academic year not found', 404);
    }

    return academicYear;
  }

  /**
   * Update an academic year's name, start date, or end date.
   */
  async update(id: string, schoolId: string, input: UpdateAcademicYearInput): Promise<AcademicYearResponse> {
    const academicYear = await prisma.academicYear.findFirst({ where: { id, schoolId } });

    if (!academicYear) {
      throw new AcademicYearServiceError('Academic year not found', 404);
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.startDate !== undefined && { startDate: new Date(input.startDate) }),
        ...(input.endDate !== undefined && { endDate: new Date(input.endDate) }),
      },
    });

    return updated;
  }

  /**
   * Delete an academic year. Cannot delete an active year.
   */
  async delete(id: string, schoolId: string): Promise<void> {
    const academicYear = await prisma.academicYear.findFirst({ where: { id, schoolId } });

    if (!academicYear) {
      throw new AcademicYearServiceError('Academic year not found', 404);
    }

    if (academicYear.isActive) {
      throw new AcademicYearServiceError('Cannot delete an active academic year. Deactivate it first.', 400);
    }

    await prisma.academicYear.delete({ where: { id } });
  }

  /**
   * Activate an academic year. Deactivates the previously active year for the same school.
   * Enforces single active academic year per school.
   */
  async activate(id: string, schoolId: string): Promise<AcademicYearResponse> {
    const academicYear = await prisma.academicYear.findFirst({
      where: { id, schoolId },
    });

    if (!academicYear) {
      throw new AcademicYearServiceError('Academic year not found', 404);
    }

    if (academicYear.isActive) {
      throw new AcademicYearServiceError('Academic year is already active', 400);
    }

    // Use a transaction to deactivate the current active year and activate the new one
    const updated = await prisma.$transaction(async (tx) => {
      // Deactivate the currently active academic year for this school
      await tx.academicYear.updateMany({
        where: { schoolId, isActive: true },
        data: { isActive: false },
      });

      // Activate the requested academic year
      return tx.academicYear.update({
        where: { id },
        data: { isActive: true },
      });
    });

    return updated;
  }

  /**
   * Deactivate an academic year.
   */
  async deactivate(id: string, schoolId: string): Promise<AcademicYearResponse> {
    const academicYear = await prisma.academicYear.findFirst({
      where: { id, schoolId },
    });

    if (!academicYear) {
      throw new AcademicYearServiceError('Academic year not found', 404);
    }

    if (!academicYear.isActive) {
      throw new AcademicYearServiceError('Academic year is already inactive', 400);
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: { isActive: false },
    });

    return updated;
  }
}

export const academicYearsService = new AcademicYearsService();
