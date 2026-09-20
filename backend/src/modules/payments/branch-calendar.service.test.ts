import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBranchCalendarSchema } from './payments.schema';

// Mock Prisma before importing the service
vi.mock('../../lib/prisma', () => ({
  default: {
    branch: { findFirst: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    branchCalendar: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';
import { branchCalendarService, BranchCalendarServiceError } from './branch-calendar.service';

const mockedPrisma = vi.mocked(prisma, true);

describe('Branch Calendar Validation', () => {
  describe('Zod schema: createBranchCalendarSchema', () => {
    it('should reject when period_end is before period_start', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'Trimester 1',
        period_start: '2025-03-01',
        period_end: '2025-02-01',
        due_date: '2025-03-15',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.issues.map((i) => i.path.join('.'));
        expect(fieldErrors).toContain('period_end');
      }
    });

    it('should reject when due_date is before period_start', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'Trimester 1',
        period_start: '2025-03-01',
        period_end: '2025-05-31',
        due_date: '2025-02-15',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.issues.map((i) => i.path.join('.'));
        expect(fieldErrors).toContain('due_date');
      }
    });

    it('should pass with valid dates', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'Trimester 1',
        period_start: '2025-01-01',
        period_end: '2025-03-31',
        due_date: '2025-01-15',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe('Trimester 1');
        expect(result.data.period_start).toBeInstanceOf(Date);
        expect(result.data.period_end).toBeInstanceOf(Date);
        expect(result.data.due_date).toBeInstanceOf(Date);
      }
    });

    it('should reject empty label', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: '',
        period_start: '2025-01-01',
        period_end: '2025-03-31',
        due_date: '2025-01-15',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.issues.map((i) => i.path.join('.'));
        expect(fieldErrors).toContain('label');
      }
    });

    it('should reject label exceeding 100 characters', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'A'.repeat(101),
        period_start: '2025-01-01',
        period_end: '2025-03-31',
        due_date: '2025-01-15',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.issues.map((i) => i.path.join('.'));
        expect(fieldErrors).toContain('label');
      }
    });

    it('should accept label of exactly 1 character', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'X',
        period_start: '2025-01-01',
        period_end: '2025-03-31',
        due_date: '2025-01-15',
      });

      expect(result.success).toBe(true);
    });

    it('should accept label of exactly 100 characters', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'A'.repeat(100),
        period_start: '2025-01-01',
        period_end: '2025-03-31',
        due_date: '2025-01-15',
      });

      expect(result.success).toBe(true);
    });

    it('should accept when period_end equals period_start', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'Single day period',
        period_start: '2025-03-01',
        period_end: '2025-03-01',
        due_date: '2025-03-01',
      });

      expect(result.success).toBe(true);
    });

    it('should accept when due_date equals period_start', () => {
      const result = createBranchCalendarSchema.safeParse({
        label: 'Due on start',
        period_start: '2025-03-01',
        period_end: '2025-05-31',
        due_date: '2025-03-01',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Service: overlap detection', () => {
    const branchId = 'branch-uuid-1';
    const academicYearId = 'ay-uuid-1';

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should throw CONFLICT error when an overlapping entry exists', async () => {
      // Setup: branch and academic year exist
      mockedPrisma.branch.findFirst.mockResolvedValue({
        id: branchId,
        name: 'Main Branch',
      } as never);
      mockedPrisma.academicYear.findFirst.mockResolvedValue({
        id: academicYearId,
      } as never);

      // An overlapping calendar entry already exists
      mockedPrisma.branchCalendar.findFirst.mockResolvedValue({
        id: 'existing-entry-id',
        branchId,
        academicYearId,
        label: 'Existing Trimester',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-03-31'),
        dueDate: new Date('2025-01-15'),
      } as never);

      await expect(
        branchCalendarService.create(branchId, academicYearId, {
          label: 'Overlapping Trimester',
          period_start: new Date('2025-02-01'),
          period_end: new Date('2025-04-30'),
          due_date: new Date('2025-02-15'),
        }),
      ).rejects.toThrow(BranchCalendarServiceError);

      try {
        await branchCalendarService.create(branchId, academicYearId, {
          label: 'Overlapping Trimester',
          period_start: new Date('2025-02-01'),
          period_end: new Date('2025-04-30'),
          due_date: new Date('2025-02-15'),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BranchCalendarServiceError);
        const serviceError = error as BranchCalendarServiceError;
        expect(serviceError.code).toBe('CONFLICT');
        expect(serviceError.statusCode).toBe(409);
        expect(serviceError.details?.overlappingEntryId).toBe('existing-entry-id');
      }
    });

    it('should succeed when no overlapping entry exists', async () => {
      // Setup: branch and academic year exist
      mockedPrisma.branch.findFirst.mockResolvedValue({
        id: branchId,
        name: 'Main Branch',
      } as never);
      mockedPrisma.academicYear.findFirst.mockResolvedValue({
        id: academicYearId,
      } as never);

      // No overlapping entry
      mockedPrisma.branchCalendar.findFirst.mockResolvedValue(null as never);

      // Create succeeds
      const createdEntry = {
        id: 'new-entry-id',
        branchId,
        academicYearId,
        label: 'Trimester 2',
        periodStart: new Date('2025-04-01'),
        periodEnd: new Date('2025-06-30'),
        dueDate: new Date('2025-04-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedPrisma.branchCalendar.create.mockResolvedValue(createdEntry as never);

      const result = await branchCalendarService.create(branchId, academicYearId, {
        label: 'Trimester 2',
        period_start: new Date('2025-04-01'),
        period_end: new Date('2025-06-30'),
        due_date: new Date('2025-04-15'),
      });

      expect(result).toEqual(createdEntry);
      expect(mockedPrisma.branchCalendar.create).toHaveBeenCalledWith({
        data: {
          branchId,
          academicYearId,
          label: 'Trimester 2',
          periodStart: new Date('2025-04-01'),
          periodEnd: new Date('2025-06-30'),
          dueDate: new Date('2025-04-15'),
        },
      });
    });

    it('should throw NOT_FOUND when branch does not exist', async () => {
      mockedPrisma.branch.findFirst.mockResolvedValue(null as never);

      await expect(
        branchCalendarService.create(branchId, academicYearId, {
          label: 'Trimester 1',
          period_start: new Date('2025-01-01'),
          period_end: new Date('2025-03-31'),
          due_date: new Date('2025-01-15'),
        }),
      ).rejects.toThrow(BranchCalendarServiceError);

      try {
        await branchCalendarService.create(branchId, academicYearId, {
          label: 'Trimester 1',
          period_start: new Date('2025-01-01'),
          period_end: new Date('2025-03-31'),
          due_date: new Date('2025-01-15'),
        });
      } catch (error) {
        const serviceError = error as BranchCalendarServiceError;
        expect(serviceError.code).toBe('NOT_FOUND');
        expect(serviceError.statusCode).toBe(404);
      }
    });

    it('should throw NOT_FOUND when academic year does not exist', async () => {
      mockedPrisma.branch.findFirst.mockResolvedValue({
        id: branchId,
        name: 'Main Branch',
      } as never);
      mockedPrisma.academicYear.findFirst.mockResolvedValue(null as never);

      await expect(
        branchCalendarService.create(branchId, academicYearId, {
          label: 'Trimester 1',
          period_start: new Date('2025-01-01'),
          period_end: new Date('2025-03-31'),
          due_date: new Date('2025-01-15'),
        }),
      ).rejects.toThrow(BranchCalendarServiceError);

      try {
        await branchCalendarService.create(branchId, academicYearId, {
          label: 'Trimester 1',
          period_start: new Date('2025-01-01'),
          period_end: new Date('2025-03-31'),
          due_date: new Date('2025-01-15'),
        });
      } catch (error) {
        const serviceError = error as BranchCalendarServiceError;
        expect(serviceError.code).toBe('NOT_FOUND');
        expect(serviceError.statusCode).toBe(404);
      }
    });
  });
});
