import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    branch: { findUnique: vi.fn(), findMany: vi.fn() },
    branchFee: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    enrollment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    child: { findMany: vi.fn() },
    billingPeriod: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    branchCalendar: { findMany: vi.fn() },
    classroomEnrollment: { findMany: vi.fn() },
    branchFeeClassroom: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { branchFeeService, BranchFeeServiceError } from './branch-fee.service';

const mockPrisma = prisma as unknown as {
  branch: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  branchFee: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  academicYear: { findFirst: ReturnType<typeof vi.fn> };
  child: { findMany: ReturnType<typeof vi.fn> };
  billingPeriod: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  branchCalendar: { findMany: ReturnType<typeof vi.fn> };
  classroomEnrollment: { findMany: ReturnType<typeof vi.fn> };
  branchFeeClassroom: { createMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('BranchFeeService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  describe('applyFeeBatch', () => {
    const oneShotFee = {
      id: 'fee-1',
      branchId: 'branch-1',
      isActive: true,
      appliesToSchool: false,
      amount: new Prisma.Decimal(500),
      billingCycle: null,
      gracePeriodDays: null,
    };
    const activeYear = {
      id: 'ay-1',
      schoolId: 'school-1',
      startDate: new Date('2998-09-01'),
      endDate: new Date('2999-06-30'),
      isActive: true,
    };

    beforeEach(() => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1', schoolId: 'school-1' });
      mockPrisma.academicYear.findFirst.mockResolvedValue(activeYear);
      mockPrisma.branchFee.findMany.mockResolvedValue([]);
      mockPrisma.billingPeriod.findMany.mockResolvedValue([]);
      mockPrisma.enrollment.findMany.mockResolvedValue([]);
    });

    it('enrolls targeted children who have no billing enrollment, then applies the fee to all of them', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(oneShotFee);
      mockPrisma.enrollment.findMany
        .mockResolvedValueOnce([{ childId: 'c1' }]) // already enrolled this year
        .mockResolvedValueOnce([{ id: 'enr-1' }, { id: 'enr-new' }]);
      mockPrisma.enrollment.create.mockResolvedValue({
        id: 'enr-new',
        childId: 'c2',
        branchId: 'branch-1',
        academicYearId: 'ay-1',
        baseFeeId: null,
        startDate: activeYear.startDate,
      });

      const result = await branchFeeService.applyFeeBatch('fee-1', 'branch-1', {
        type: 'children',
        childIds: ['c1', 'c2'],
      });

      expect(mockPrisma.enrollment.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.enrollment.create.mock.calls[0][0].data).toMatchObject({
        childId: 'c2',
        academicYearId: 'ay-1',
        baseFeeId: null,
        startDate: activeYear.startDate, // today is before this year, so clamped to its start
        status: 'active',
      });
      // The newly enrolled child gets whole-school fees, except the one being assigned.
      expect(mockPrisma.branchFee.findMany.mock.calls[0][0].where.id).toEqual({ notIn: ['fee-1'] });
      expect(result).toEqual({ applied: 2, skipped: 0, yearEnded: 0, enrolled: 1, total: 2 });
      const inserted = mockPrisma.billingPeriod.createMany.mock.calls[0][0].data as Array<{ enrollmentId: string }>;
      expect(inserted.map((p) => p.enrollmentId)).toEqual(['enr-1', 'enr-new']);
    });

    it('rejects the assignment when the school has no active academic year', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(oneShotFee);
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(
        branchFeeService.applyFeeBatch('fee-1', 'branch-1', { type: 'children', childIds: ['c1'] }),
      ).rejects.toThrow('No active academic year');
    });

    it('skips a recurring fee for enrollments whose academic year has already ended', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        ...oneShotFee,
        id: 'fee-2',
        amount: new Prisma.Decimal(3000),
        billingCycle: 'monthly',
        billingDueDay: 5,
        gracePeriodDays: 5,
      });
      mockPrisma.enrollment.findMany
        .mockResolvedValueOnce([{ childId: 'c1' }])
        .mockResolvedValueOnce([{ id: 'enr-1' }])
        .mockResolvedValueOnce([
          {
            id: 'enr-1',
            branchId: 'branch-1',
            academicYearId: 'ay-1',
            academicYear: { startDate: new Date('2000-09-01'), endDate: new Date('2001-06-30') },
          },
        ]);

      const result = await branchFeeService.applyFeeBatch('fee-2', 'branch-1', {
        type: 'children',
        childIds: ['c1'],
      });

      expect(result).toEqual({ applied: 0, skipped: 0, yearEnded: 1, enrolled: 0, total: 1 });
      expect(mockPrisma.billingPeriod.createMany).not.toHaveBeenCalled();
    });

    it('scopes the fee to the whole school when assigned to the school', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(oneShotFee);
      mockPrisma.child.findMany.mockResolvedValue([]);

      await branchFeeService.applyFeeBatch('fee-1', 'branch-1', { type: 'school' });

      expect(mockPrisma.branchFee.update).toHaveBeenCalledWith({
        where: { id: 'fee-1' },
        data: { appliesToSchool: true },
      });
      expect(mockPrisma.child.findMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1', isActive: true },
        select: { id: true },
      });
    });

    it('links the fee to the classrooms it is assigned to', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(oneShotFee);
      mockPrisma.classroomEnrollment.findMany.mockResolvedValue([]);

      await branchFeeService.applyFeeBatch('fee-1', 'branch-1', {
        type: 'classrooms',
        classroomIds: ['class-1', 'class-2'],
      });

      expect(mockPrisma.branchFeeClassroom.createMany).toHaveBeenCalledWith({
        data: [
          { branchFeeId: 'fee-1', classroomId: 'class-1' },
          { branchFeeId: 'fee-1', classroomId: 'class-2' },
        ],
        skipDuplicates: true,
      });
      expect(mockPrisma.branchFee.update).not.toHaveBeenCalled();
    });

    it('does not scope the fee to the school when assigned to specific children', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(oneShotFee);
      mockPrisma.enrollment.findMany.mockResolvedValueOnce([{ childId: 'c1' }]);

      await branchFeeService.applyFeeBatch('fee-1', 'branch-1', { type: 'children', childIds: ['c1'] });

      expect(mockPrisma.branchFee.update).not.toHaveBeenCalled();
    });
  });

  describe('applySchoolFeesToEnrollment', () => {
    const enrollment = {
      id: 'enr-new',
      branchId: 'branch-1',
      academicYearId: 'ay-1',
      baseFeeId: 'fee-base',
      startDate: new Date('2999-01-15'),
      academicYear: { startDate: new Date('2998-09-01'), endDate: new Date('2999-06-30') },
    };

    it('applies whole-school fees other than the base fee, billing recurring ones from the start date', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1', schoolId: 'school-1' });
      mockPrisma.branchFee.findMany.mockResolvedValue([
        {
          id: 'fee-monthly',
          name: 'Cantine',
          amount: new Prisma.Decimal(2000),
          billingCycle: 'monthly',
          billingDueDay: 5,
          gracePeriodDays: 5,
        },
        { id: 'fee-once', name: 'Assurance', amount: new Prisma.Decimal(500), billingCycle: null, gracePeriodDays: null },
      ]);
      mockPrisma.billingPeriod.createMany.mockResolvedValue({ count: 6 });
      mockPrisma.billingPeriod.create.mockResolvedValue({ id: 'bp-1' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await branchFeeService.applySchoolFeesToEnrollment(mockPrisma as any, enrollment);

      expect(count).toBe(2);
      expect(mockPrisma.branchFee.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          appliesToSchool: true,
          branch: { schoolId: 'school-1' },
          id: { notIn: ['fee-base'] },
        },
      });
      const monthly = mockPrisma.billingPeriod.createMany.mock.calls[0][0].data as Array<{ periodStart: Date }>;
      expect(monthly).toHaveLength(6); // Jan through Jun
      expect(monthly[0].periodStart.getMonth()).toBe(0);
      expect(mockPrisma.billingPeriod.create).toHaveBeenCalledTimes(1);
    });
  });
});
