import prisma from '../../lib/prisma';
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
