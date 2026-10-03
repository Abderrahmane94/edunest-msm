import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    discount: { create: vi.fn(), findMany: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    branchFee: { findUnique: vi.fn() },
    billingPeriod: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { discountService, DiscountServiceError } from './discount.service';

const mockPrisma = prisma as unknown as {
  discount: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  branchFee: { findUnique: ReturnType<typeof vi.fn> };
  billingPeriod: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const dec = (v: string | number) => new Prisma.Decimal(v);

function period(id: string, branchFeeId: string, base: string | null, amountDue: string, paid = 0) {
  return {
    id,
    branchFeeId,
    periodStart: new Date('2026-02-01'),
    baseAmount: base === null ? null : dec(base),
    amountDue: dec(amountDue),
    paymentAllocations: paid ? [{ amount: dec(paid) }] : [],
  };
}

function updates() {
  return (
    mockPrisma.billingPeriod.update.mock.calls as Array<
      [{ where: { id: string }; data: { amountDue: Prisma.Decimal; baseAmount: Prisma.Decimal } }]
    >
  ).map(([arg]) => ({ id: arg.where.id, amountDue: arg.data.amountDue.toString(), baseAmount: arg.data.baseAmount.toString() }));
}

describe('DiscountService.recalculatePeriods (via create)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockPrisma.discount.create.mockResolvedValue({ id: 'disc-1', enrollmentId: 'enr-1' });
    mockPrisma.enrollment.findUnique.mockResolvedValue({ status: 'active', branchId: 'branch-1' });
    mockPrisma.discount.findMany.mockResolvedValue([
      { id: 'disc-1', branchFeeId: null, percentage: dec(20), validFrom: new Date('2026-01-01'), validTo: null },
    ]);
  });

  it('only looks at recurring-fee periods (no one-off fees, no registration, not cancelled)', async () => {
    mockPrisma.billingPeriod.findMany.mockResolvedValue([]);

    await discountService.create('enr-1', { type: 'sibling', percentage: 20, validFrom: '2026-01-01' }, 'user-1');

    expect(mockPrisma.billingPeriod.findMany.mock.calls[0][0].where).toEqual({
      enrollmentId: 'enr-1',
      isRegistrationPeriod: false,
      cancelledAt: null,
      branchFee: { billingCycle: { not: null } },
    });
  });

  it('applies an all-fees discount to every recurring fee, from each period\'s base amount', async () => {
    mockPrisma.billingPeriod.findMany.mockResolvedValue([
      period('tuition-feb', 'fee-tuition', '10000', '10000'),
      // A prorated first period keeps its prorated base.
      period('canteen-feb', 'fee-canteen', '2000', '2000'),
    ]);

    await discountService.create('enr-1', { type: 'sibling', percentage: 20, validFrom: '2026-01-01' }, 'user-1');

    expect(updates()).toEqual([
      { id: 'tuition-feb', amountDue: '8000', baseAmount: '10000' },
      { id: 'canteen-feb', amountDue: '1600', baseAmount: '2000' },
    ]);
  });

  it('applies a fee-targeted discount only to that fee\'s periods', async () => {
    mockPrisma.branchFee.findUnique.mockResolvedValue({ branchId: 'branch-1', billingCycle: 'monthly' });
    mockPrisma.discount.findMany.mockResolvedValue([
      { id: 'disc-1', branchFeeId: 'fee-tuition', percentage: dec(10), validFrom: new Date('2026-01-01'), validTo: null },
    ]);
    mockPrisma.billingPeriod.findMany.mockResolvedValue([
      period('tuition-feb', 'fee-tuition', '10000', '10000'),
      period('canteen-feb', 'fee-canteen', '2000', '2000'),
    ]);

    await discountService.create(
      'enr-1',
      { type: 'sibling', percentage: 10, validFrom: '2026-01-01', branchFeeId: '00000000-0000-0000-0000-000000000001' },
      'user-1',
    );

    // The canteen period stays at its base amount: nothing to write.
    expect(updates()).toEqual([{ id: 'tuition-feb', amountDue: '9000', baseAmount: '10000' }]);
  });

  it('restores the base amount once no discount applies any more', async () => {
    mockPrisma.discount.findMany.mockResolvedValue([]);
    mockPrisma.billingPeriod.findMany.mockResolvedValue([period('tuition-feb', 'fee-tuition', '10000', '8000')]);

    await discountService.create('enr-1', { type: 'sibling', percentage: 20, validFrom: '2026-01-01' }, 'user-1');

    expect(updates()).toEqual([{ id: 'tuition-feb', amountDue: '10000', baseAmount: '10000' }]);
  });

  it('falls back to the current amount for periods created before base amounts were stored', async () => {
    mockPrisma.billingPeriod.findMany.mockResolvedValue([period('old-feb', 'fee-tuition', null, '10000')]);

    await discountService.create('enr-1', { type: 'sibling', percentage: 20, validFrom: '2026-01-01' }, 'user-1');

    expect(updates()).toEqual([{ id: 'old-feb', amountDue: '8000', baseAmount: '10000' }]);
  });

  it('does not touch a period that already has a payment allocation', async () => {
    mockPrisma.billingPeriod.findMany.mockResolvedValue([period('paid-feb', 'fee-tuition', '10000', '10000', 5000)]);

    await discountService.create('enr-1', { type: 'sibling', percentage: 20, validFrom: '2026-01-01' }, 'user-1');

    expect(mockPrisma.billingPeriod.update).not.toHaveBeenCalled();
  });

  it('leaves a withdrawn enrollment untouched', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({ status: 'withdrawn', branchId: 'branch-1' });

    await discountService.create('enr-1', { type: 'sibling', percentage: 20, validFrom: '2026-01-01' }, 'user-1');

    expect(mockPrisma.billingPeriod.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.billingPeriod.update).not.toHaveBeenCalled();
  });

  it('rejects targeting a one-off fee', async () => {
    mockPrisma.branchFee.findUnique.mockResolvedValue({ branchId: 'branch-1', billingCycle: null });

    await expect(
      discountService.create(
        'enr-1',
        { type: 'sibling', percentage: 10, validFrom: '2026-01-01', branchFeeId: '00000000-0000-0000-0000-000000000001' },
        'user-1',
      ),
    ).rejects.toThrow(DiscountServiceError);
    expect(mockPrisma.discount.create).not.toHaveBeenCalled();
  });
});
