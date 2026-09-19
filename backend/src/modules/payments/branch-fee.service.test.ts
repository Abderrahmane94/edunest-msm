import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    branch: { findUnique: vi.fn() },
    branchFee: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    enrollment: { findUnique: vi.fn(), findMany: vi.fn() },
    billingPeriod: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    branchCalendar: { findMany: vi.fn() },
    classroomEnrollment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { branchFeeService, BranchFeeServiceError } from './branch-fee.service';

const mockPrisma = prisma as unknown as {
  branch: { findUnique: ReturnType<typeof vi.fn> };
  branchFee: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  enrollment: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  billingPeriod: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  branchCalendar: { findMany: ReturnType<typeof vi.fn> };
  classroomEnrollment: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('BranchFeeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  describe('create/update cycle field validation', () => {
    it('creates a one-shot fee with no cycle fields', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.branchFee.create.mockResolvedValue({ id: 'fee-1' });

      await branchFeeService.create('branch-1', { name: 'Field trip', amount: 500 });

      expect(mockPrisma.branchFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          billingCycle: null,
          billingDueDay: null,
          gracePeriodDays: null,
        }),
      });
    });

    it('creates a recurring fee when all three cycle fields are provided', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.branchFee.create.mockResolvedValue({ id: 'fee-1' });

      await branchFeeService.create('branch-1', {
        name: 'Tuition',
        amount: 15000,
        billingCycle: 'monthly',
        billingDueDay: 5,
        gracePeriodDays: 5,
      });

      expect(mockPrisma.branchFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          billingCycle: 'monthly',
          billingDueDay: 5,
          gracePeriodDays: 5,
        }),
      });
    });

    it('rejects a partial cycle configuration (missing gracePeriodDays)', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });

      await expect(
        branchFeeService.create('branch-1', {
          name: 'Tuition',
          amount: 15000,
          billingCycle: 'monthly',
          billingDueDay: 5,
        }),
      ).rejects.toThrow(BranchFeeServiceError);
      expect(mockPrisma.branchFee.create).not.toHaveBeenCalled();
    });

    it('rejects an out-of-range billingDueDay', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });

      await expect(
        branchFeeService.create('branch-1', {
          name: 'Tuition',
          amount: 15000,
          billingCycle: 'monthly',
          billingDueDay: 31,
          gracePeriodDays: 5,
        }),
      ).rejects.toThrow(BranchFeeServiceError);
    });
  });

  describe('applyFeeToEnrollment', () => {
    it('creates a single one-shot period for a fee with no billing cycle', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-1',
        branchId: 'branch-1',
        isActive: true,
        amount: new Prisma.Decimal(500),
        billingCycle: null,
        gracePeriodDays: null,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        academicYear: { startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
      });
      mockPrisma.billingPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.billingPeriod.create.mockResolvedValue({ id: 'period-1' });

      const result = await branchFeeService.applyFeeToEnrollment('fee-1', 'enr-1');

      expect(mockPrisma.billingPeriod.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.billingPeriod.createMany).not.toHaveBeenCalled();
      expect(result).toHaveProperty('billingPeriod');
    });

    it('generates a full cycle of periods for a recurring fee', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-2',
        branchId: 'branch-1',
        isActive: true,
        amount: new Prisma.Decimal(3000),
        billingCycle: 'monthly',
        billingDueDay: 5,
        gracePeriodDays: 5,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        academicYear: { startDate: new Date('2026-09-01'), endDate: new Date('2026-11-30') },
      });
      mockPrisma.billingPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.billingPeriod.createMany.mockResolvedValue({ count: 3 });

      const result = await branchFeeService.applyFeeToEnrollment('fee-2', 'enr-1');

      expect(mockPrisma.billingPeriod.createMany).toHaveBeenCalledTimes(1);
      const insertedData = mockPrisma.billingPeriod.createMany.mock.calls[0][0].data as Array<{
        branchFeeId: string;
      }>;
      expect(insertedData.length).toBeGreaterThan(0);
      expect(insertedData.every((p) => p.branchFeeId === 'fee-2')).toBe(true);
      expect(result).toHaveProperty('periodsCreated');
    });

    it('rejects re-applying a fee that already has a non-cancelled period', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-1',
        branchId: 'branch-1',
        isActive: true,
        amount: new Prisma.Decimal(500),
        billingCycle: null,
        gracePeriodDays: null,
      });
      mockPrisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        academicYear: { startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
      });
      mockPrisma.billingPeriod.findFirst.mockResolvedValue({ id: 'existing-period' });

      await expect(branchFeeService.applyFeeToEnrollment('fee-1', 'enr-1')).rejects.toThrow(
        BranchFeeServiceError,
      );
      expect(mockPrisma.billingPeriod.create).not.toHaveBeenCalled();
      expect(mockPrisma.billingPeriod.createMany).not.toHaveBeenCalled();
    });
  });
});
