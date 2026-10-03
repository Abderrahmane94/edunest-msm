import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    branch: { findUnique: vi.fn(), findMany: vi.fn() },
    branchFee: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    enrollment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    child: { findMany: vi.fn() },
    billingPeriod: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    branchCalendar: { findMany: vi.fn() },
    classroom: { findMany: vi.fn() },
    classroomEnrollment: { findMany: vi.fn() },
    branchFeeClassroom: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('./discount.service', () => ({ discountService: { recalculatePeriods: vi.fn() } }));

import prisma from '../../lib/prisma';
import { discountService } from './discount.service';
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
    updateMany: ReturnType<typeof vi.fn>;
  };
  branchCalendar: { findMany: ReturnType<typeof vi.fn> };
  classroom: { findMany: ReturnType<typeof vi.fn> };
  classroomEnrollment: { findMany: ReturnType<typeof vi.fn> };
  branchFeeClassroom: { createMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
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
      // New periods pick up the enrollment's existing discounts.
      expect(discountService.recalculatePeriods).toHaveBeenCalledWith(mockPrisma, 'enr-1');
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
      expect(result).toEqual({ applied: 2, skipped: 0, skippedChildren: [], yearEnded: 0, enrolled: 1, total: 2 });
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

      expect(result).toEqual({ applied: 0, skipped: 0, skippedChildren: [], yearEnded: 1, enrolled: 0, total: 1 });
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
      // One scope at a time: whole-school replaces any classroom links.
      expect(mockPrisma.branchFeeClassroom.deleteMany).toHaveBeenCalledWith({ where: { branchFeeId: 'fee-1' } });
    });

    it('rejects assigning a whole-school fee to classrooms instead of silently linking them', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({ ...oneShotFee, appliesToSchool: true });

      await expect(
        branchFeeService.applyFeeBatch('fee-1', 'branch-1', { type: 'classrooms', classroomIds: ['class-1'] }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'SCOPE_CONFLICT' });
      expect(mockPrisma.branchFeeClassroom.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.billingPeriod.createMany).not.toHaveBeenCalled();
    });

    it('names the children skipped for already having the fee', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(oneShotFee);
      mockPrisma.enrollment.findMany
        .mockResolvedValueOnce([{ childId: 'c1' }, { childId: 'c2' }]) // already enrolled this year
        .mockResolvedValueOnce([{ id: 'enr-1' }, { id: 'enr-2' }])
        .mockResolvedValueOnce([{ child: { id: 'c1', firstName: 'Amel', lastName: 'B' } }]);
      mockPrisma.billingPeriod.findMany.mockResolvedValue([{ enrollmentId: 'enr-1' }]);

      const result = await branchFeeService.applyFeeBatch('fee-1', 'branch-1', {
        type: 'children',
        childIds: ['c1', 'c2'],
      });

      expect(result).toMatchObject({ applied: 1, skipped: 1, skippedChildren: [{ id: 'c1', name: 'Amel B' }] });
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

  describe('update', () => {
    it('drops classroom links when the fee is scoped to the whole school', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({ id: 'fee-1' });
      mockPrisma.branchFee.update.mockResolvedValue({ id: 'fee-1' });

      await branchFeeService.update('fee-1', { appliesToSchool: true });

      expect(mockPrisma.branchFeeClassroom.deleteMany).toHaveBeenCalledWith({ where: { branchFeeId: 'fee-1' } });
      expect(mockPrisma.branchFee.update).toHaveBeenCalledWith({
        where: { id: 'fee-1' },
        data: { appliesToSchool: true },
      });
    });
  });

  describe('changeScope', () => {
    const fee = { id: 'fee-1', appliesToSchool: true, branch: { schoolId: 'school-1' } };
    // Two out-of-scope children (Class B): c3 owes two unpaid charges — p1
    // already due, p2 not yet due — and c4 one that is already paid.
    const past = new Date('2000-01-05');
    const future = new Date('2999-01-05');
    const outOfScopePeriods = [
      { id: 'p1', amountDue: new Prisma.Decimal(3000), dueDate: past, enrollment: { childId: 'c3' }, paymentAllocations: [] },
      { id: 'p2', amountDue: new Prisma.Decimal(1500.5), dueDate: future, enrollment: { childId: 'c3' }, paymentAllocations: [] },
      {
        id: 'p3',
        amountDue: new Prisma.Decimal(3000),
        dueDate: past,
        enrollment: { childId: 'c4' },
        paymentAllocations: [{ id: 'a1' }],
      },
    ];

    beforeEach(() => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(fee);
      mockPrisma.classroom.findMany.mockResolvedValue([{ id: 'class-a' }]);
      mockPrisma.classroomEnrollment.findMany.mockResolvedValue([{ childId: 'c1' }, { childId: 'c2' }]);
      mockPrisma.billingPeriod.findMany.mockResolvedValue(outOfScopePeriods);
      mockPrisma.billingPeriod.updateMany.mockResolvedValue({ count: 2 });
    });

    it('previews the unpaid out-of-scope charges on a dry run without changing anything', async () => {
      const result = await branchFeeService.changeScope('fee-1', {
        scope: 'classrooms',
        classroomIds: ['class-a'],
        dryRun: true,
      });

      expect(result).toEqual({
        dryRun: true,
        childrenAffected: 1,
        periodsToCancel: 2,
        amountToCancel: '4500.50',
        duePeriods: 1,
        dueAmount: '3000.00',
        notYetDuePeriods: 1,
        notYetDueAmount: '1500.50',
        paidPeriodsKept: 1,
        cancelled: 0,
      });
      // Out of scope = not in the target classrooms, current school year only.
      expect(mockPrisma.billingPeriod.findMany.mock.calls[0][0].where).toEqual({
        branchFeeId: 'fee-1',
        cancelledAt: null,
        enrollment: { childId: { notIn: ['c1', 'c2'] }, academicYear: { isActive: true } },
      });
      expect(mockPrisma.branchFee.update).not.toHaveBeenCalled();
      expect(mockPrisma.branchFeeClassroom.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.billingPeriod.updateMany).not.toHaveBeenCalled();
    });

    it('narrows the scope and cancels all unpaid out-of-scope charges with cancelUnpaid', async () => {
      const result = await branchFeeService.changeScope('fee-1', {
        scope: 'classrooms',
        classroomIds: ['class-a'],
        outOfScope: 'cancelUnpaid',
      });

      expect(mockPrisma.branchFee.update).toHaveBeenCalledWith({
        where: { id: 'fee-1' },
        data: { appliesToSchool: false },
      });
      expect(mockPrisma.branchFeeClassroom.deleteMany).toHaveBeenCalledWith({ where: { branchFeeId: 'fee-1' } });
      expect(mockPrisma.branchFeeClassroom.createMany).toHaveBeenCalledWith({
        data: [{ branchFeeId: 'fee-1', classroomId: 'class-a' }],
      });
      expect(mockPrisma.billingPeriod.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] }, cancelledAt: null, paymentAllocations: { none: {} } },
        data: { cancelledAt: expect.any(Date) },
      });
      expect(result).toMatchObject({ dryRun: false, cancelled: 2, paidPeriodsKept: 1 });
    });

    it('keeps charges already due and cancels only not-yet-due ones with cancelNotYetDue', async () => {
      mockPrisma.billingPeriod.updateMany.mockResolvedValue({ count: 1 });

      const result = await branchFeeService.changeScope('fee-1', {
        scope: 'classrooms',
        classroomIds: ['class-a'],
        outOfScope: 'cancelNotYetDue',
      });

      expect(mockPrisma.billingPeriod.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p2'] }, cancelledAt: null, paymentAllocations: { none: {} } },
        data: { cancelledAt: expect.any(Date) },
      });
      expect(result).toMatchObject({ dryRun: false, cancelled: 1 });
    });

    it('counts a charge due today as already due', async () => {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      // A @db.Date column comes back as the calendar day at UTC midnight.
      const dueToday = new Date(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
      mockPrisma.billingPeriod.findMany.mockResolvedValue([
        { id: 'p1', amountDue: new Prisma.Decimal(3000), dueDate: dueToday, enrollment: { childId: 'c3' }, paymentAllocations: [] },
      ]);

      const result = await branchFeeService.changeScope('fee-1', {
        scope: 'classrooms',
        classroomIds: ['class-a'],
        dryRun: true,
      });

      expect(result).toMatchObject({ duePeriods: 1, notYetDuePeriods: 0 });
    });

    it('rejects an unknown out-of-scope action', async () => {
      await expect(
        branchFeeService.changeScope('fee-1', {
          scope: 'classrooms',
          classroomIds: ['class-a'],
          outOfScope: 'cancelEverything' as never,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('keeps every charge when narrowing without cancellation', async () => {
      const result = await branchFeeService.changeScope('fee-1', {
        scope: 'classrooms',
        classroomIds: ['class-a'],
      });

      expect(mockPrisma.branchFee.update).toHaveBeenCalled();
      expect(mockPrisma.billingPeriod.updateMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({ periodsToCancel: 2, cancelled: 0 });
    });

    it('scoping to the whole school drops classroom links and leaves nobody out', async () => {
      const result = await branchFeeService.changeScope('fee-1', { scope: 'school', outOfScope: 'cancelUnpaid' });

      expect(mockPrisma.branchFee.update).toHaveBeenCalledWith({
        where: { id: 'fee-1' },
        data: { appliesToSchool: true },
      });
      expect(mockPrisma.branchFeeClassroom.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.branchFeeClassroom.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.billingPeriod.findMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({ periodsToCancel: 0, cancelled: 0 });
    });

    it('scoping to none stops automatic application but keeps hand-assigned charges', async () => {
      const result = await branchFeeService.changeScope('fee-1', { scope: 'none', outOfScope: 'cancelUnpaid' });

      expect(mockPrisma.branchFee.update).toHaveBeenCalledWith({
        where: { id: 'fee-1' },
        data: { appliesToSchool: false },
      });
      expect(mockPrisma.billingPeriod.updateMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({ periodsToCancel: 0, cancelled: 0 });
    });

    it('rejects the classrooms scope without classrooms', async () => {
      await expect(branchFeeService.changeScope('fee-1', { scope: 'classrooms', classroomIds: [] })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("rejects classrooms outside the fee's school", async () => {
      mockPrisma.classroom.findMany.mockResolvedValue([]);

      await expect(
        branchFeeService.changeScope('fee-1', { scope: 'classrooms', classroomIds: ['other-school-class'] }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.branchFee.update).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND for an unknown fee', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(null);

      await expect(branchFeeService.changeScope('missing', { scope: 'none' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('applySchoolFeesToEnrollment', () => {
    const enrollment = {
      id: 'enr-new',
      branchId: 'branch-1',
      academicYearId: 'ay-1',
      startDate: new Date('2999-01-15'),
      academicYear: { startDate: new Date('2998-09-01'), endDate: new Date('2999-06-30') },
    };

    it('applies whole-school fees except the ones excluded, billing recurring ones from the start date', async () => {
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
      const count = await branchFeeService.applySchoolFeesToEnrollment(mockPrisma as any, enrollment, ['fee-base']);

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

  describe('applyFeesToNewEnrollment', () => {
    const enrollment = {
      id: 'enr-new',
      branchId: 'branch-1',
      academicYearId: 'ay-1',
      startDate: new Date('2999-01-15'),
      academicYear: { startDate: new Date('2998-09-01'), endDate: new Date('2999-06-30') },
    };
    const tuition = {
      id: 'fee-tuition',
      name: 'Scolarité',
      branchId: 'branch-1',
      isActive: true,
      amount: new Prisma.Decimal(10000),
      billingCycle: 'monthly',
      billingDueDay: 5,
      gracePeriodDays: 5,
    };
    const insurance = {
      id: 'fee-insurance',
      name: 'Assurance',
      branchId: 'branch-1',
      isActive: true,
      amount: new Prisma.Decimal(1500),
      billingCycle: null,
      gracePeriodDays: null,
    };

    beforeEach(() => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1', schoolId: 'school-1' });
      mockPrisma.billingPeriod.createMany.mockResolvedValue({ count: 6 });
      mockPrisma.billingPeriod.create.mockResolvedValue({ id: 'bp-1' });
    });

    it('applies school fees (minus the picked ones) and the picked fees, billing recurring ones from the start date', async () => {
      mockPrisma.branchFee.findMany
        .mockResolvedValueOnce([]) // whole-school fees
        .mockResolvedValueOnce([tuition, insurance]); // picked fees

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await branchFeeService.applyFeesToNewEnrollment(mockPrisma as any, enrollment, ['fee-tuition', 'fee-insurance', 'fee-tuition']);

      // Picked fees aren't applied a second time as school fees.
      expect(mockPrisma.branchFee.findMany.mock.calls[0][0].where.id).toEqual({ notIn: ['fee-tuition', 'fee-insurance'] });

      const monthly = mockPrisma.billingPeriod.createMany.mock.calls[0][0].data as Array<{
        periodStart: Date;
        amountDue: Prisma.Decimal;
        baseAmount: Prisma.Decimal;
      }>;
      expect(monthly).toHaveLength(6); // Jan (from the 15th, prorated) through Jun
      expect(monthly[0].periodStart.getMonth()).toBe(0);
      expect(Number(monthly[0].amountDue)).toBeLessThan(10000);
      expect(monthly[0].baseAmount.toString()).toBe(monthly[0].amountDue.toString());
      expect(mockPrisma.billingPeriod.create.mock.calls[0][0].data).toMatchObject({
        branchFeeId: 'fee-insurance',
        amountDue: insurance.amount,
        baseAmount: insurance.amount,
      });
      expect(discountService.recalculatePeriods).toHaveBeenCalledWith(mockPrisma, 'enr-new');
    });

    it('rejects a fee that is not available (inactive or from another branch)', async () => {
      mockPrisma.branchFee.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...insurance, isActive: false }]);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchFeeService.applyFeesToNewEnrollment(mockPrisma as any, enrollment, ['fee-insurance']),
      ).rejects.toThrow('Assurance: fee is not available');
    });

    it('rejects an unknown fee', async () => {
      mockPrisma.branchFee.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        branchFeeService.applyFeesToNewEnrollment(mockPrisma as any, enrollment, ['missing']),
      ).rejects.toThrow('Fee not found');
    });
  });
});
