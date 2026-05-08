import { describe, it, expect, vi, beforeEach } from 'vitest';
import { academicYearsService, AcademicYearServiceError } from './academic-years.service';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    academicYear: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';

const mockPrisma = prisma as unknown as {
  academicYear: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('AcademicYearsService', () => {
  const schoolId = 'school-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create an academic year with isActive set to false', async () => {
      const input = { name: '2024-2025', startDate: '2024-09-01', endDate: '2025-06-30' };
      const expected = {
        id: 'ay-1',
        schoolId,
        name: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-06-30'),
        isActive: false,
        createdAt: new Date(),
      };

      mockPrisma.academicYear.create.mockResolvedValue(expected);

      const result = await academicYearsService.create(schoolId, input);

      expect(mockPrisma.academicYear.create).toHaveBeenCalledWith({
        data: {
          schoolId,
          name: '2024-2025',
          startDate: new Date('2024-09-01'),
          endDate: new Date('2025-06-30'),
          isActive: false,
        },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('list', () => {
    it('should return paginated academic years for a school', async () => {
      const academicYears = [
        { id: 'ay-1', schoolId, name: '2024-2025', startDate: new Date(), endDate: new Date(), isActive: true, createdAt: new Date() },
        { id: 'ay-2', schoolId, name: '2023-2024', startDate: new Date(), endDate: new Date(), isActive: false, createdAt: new Date() },
      ];

      mockPrisma.academicYear.findMany.mockResolvedValue(academicYears);
      mockPrisma.academicYear.count.mockResolvedValue(2);

      const result = await academicYearsService.list(schoolId, 1, 20);

      expect(result.academicYears).toEqual(academicYears);
      expect(result.total).toBe(2);
      expect(mockPrisma.academicYear.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply correct pagination offset', async () => {
      mockPrisma.academicYear.findMany.mockResolvedValue([]);
      mockPrisma.academicYear.count.mockResolvedValue(0);

      await academicYearsService.list(schoolId, 3, 10);

      expect(mockPrisma.academicYear.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 20,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getById', () => {
    it('should return an academic year when found', async () => {
      const academicYear = {
        id: 'ay-1',
        schoolId,
        name: '2024-2025',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);

      const result = await academicYearsService.getById('ay-1', schoolId);

      expect(result).toEqual(academicYear);
      expect(mockPrisma.academicYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'ay-1', schoolId },
      });
    });

    it('should throw 404 when academic year not found', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(academicYearsService.getById('nonexistent', schoolId)).rejects.toThrow(
        AcademicYearServiceError,
      );
      await expect(academicYearsService.getById('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Academic year not found',
        statusCode: 404,
      });
    });
  });

  describe('activate', () => {
    it('should deactivate previous active year and activate the requested one', async () => {
      const academicYear = {
        id: 'ay-2',
        schoolId,
        name: '2024-2025',
        startDate: new Date(),
        endDate: new Date(),
        isActive: false,
        createdAt: new Date(),
      };

      const activated = { ...academicYear, isActive: true };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.academicYear.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.academicYear.update.mockResolvedValue(activated);

      const result = await academicYearsService.activate('ay-2', schoolId);

      expect(result.isActive).toBe(true);
      expect(mockPrisma.academicYear.updateMany).toHaveBeenCalledWith({
        where: { schoolId, isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.academicYear.update).toHaveBeenCalledWith({
        where: { id: 'ay-2' },
        data: { isActive: true },
      });
    });

    it('should throw 404 when academic year not found', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(academicYearsService.activate('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Academic year not found',
        statusCode: 404,
      });
    });

    it('should throw 400 when academic year is already active', async () => {
      const academicYear = {
        id: 'ay-1',
        schoolId,
        name: '2024-2025',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);

      await expect(academicYearsService.activate('ay-1', schoolId)).rejects.toMatchObject({
        message: 'Academic year is already active',
        statusCode: 400,
      });
    });
  });

  describe('deactivate', () => {
    it('should deactivate an active academic year', async () => {
      const academicYear = {
        id: 'ay-1',
        schoolId,
        name: '2024-2025',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
        createdAt: new Date(),
      };

      const deactivated = { ...academicYear, isActive: false };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);
      mockPrisma.academicYear.update.mockResolvedValue(deactivated);

      const result = await academicYearsService.deactivate('ay-1', schoolId);

      expect(result.isActive).toBe(false);
      expect(mockPrisma.academicYear.update).toHaveBeenCalledWith({
        where: { id: 'ay-1' },
        data: { isActive: false },
      });
    });

    it('should throw 404 when academic year not found', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(academicYearsService.deactivate('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Academic year not found',
        statusCode: 404,
      });
    });

    it('should throw 400 when academic year is already inactive', async () => {
      const academicYear = {
        id: 'ay-1',
        schoolId,
        name: '2024-2025',
        startDate: new Date(),
        endDate: new Date(),
        isActive: false,
        createdAt: new Date(),
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);

      await expect(academicYearsService.deactivate('ay-1', schoolId)).rejects.toMatchObject({
        message: 'Academic year is already inactive',
        statusCode: 400,
      });
    });
  });
});
