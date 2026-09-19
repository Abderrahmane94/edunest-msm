import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    discount: { create: vi.fn(), findMany: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    billingPeriod: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { discountService } from './discount.service';

const mockPrisma = prisma as unknown as {
  discount: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  enrollment: { findUnique: ReturnType<typeof vi.fn> };
  billingPeriod: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('DiscountService.recalculatePeriods (via create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockPrisma.discount.create.mockResolvedValue({ id: 'disc-1', enrollmentId: 'enr-1' });
    mockPrisma.discount.findMany.mockResolvedValue([
      { id: 'disc-1', percentage: new Prisma.Decimal(20), validFrom: new Date('2026-01-01'), validTo: null },
    ]);
  });

  it('recalculates the base fee\'s own periods (branchFeeId null or matching baseFeeId)', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      recurringFee: new Prisma.Decimal(10000),
      baseFeeId: 'base-fee-1',
    });
    mockPrisma.billingPeriod.findMany.mockResolvedValue([
      {
        id: 'period-null',
        periodStart: new Date('2026-02-01'),
        amountDue: new Prisma.Decimal(10000),
        paymentAllocations: [],
      },
      {
        id: 'period-base-fee',
        periodStart: new Date('2026-03-01'),
        amountDue: new Prisma.Decimal(10000),
        paymentAllocations: [],
      },
    ]);

    await discountService.create('enr-1', {
      type: 'scholarship',
      percentage: 20,
      validFrom: '2026-01-01',
    }, 'user-1');

    // The query must only ever fetch periods with branchFeeId null or the enrollment's base fee.
    const where = mockPrisma.billingPeriod.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ branchFeeId: null }, { branchFeeId: 'base-fee-1' }]);

    expect(mockPrisma.billingPeriod.update).toHaveBeenCalledTimes(2);
    const updatedIds = mockPrisma.billingPeriod.update.mock.calls.map(
      (call: [{ where: { id: string } }]) => call[0].where.id,
    );
    expect(updatedIds.sort()).toEqual(['period-base-fee', 'period-null']);
    const firstUpdateAmount = mockPrisma.billingPeriod.update.mock.calls[0][0].data.amountDue as Prisma.Decimal;
    expect(firstUpdateAmount.toString()).toBe('8000'); // 20% off 10000
  });

  it('does not touch a period that already has a payment allocation', async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      recurringFee: new Prisma.Decimal(10000),
      baseFeeId: null,
    });
    mockPrisma.billingPeriod.findMany.mockResolvedValue([
      {
        id: 'period-paid',
        periodStart: new Date('2026-02-01'),
        amountDue: new Prisma.Decimal(10000),
        paymentAllocations: [{ amount: new Prisma.Decimal(5000) }],
      },
    ]);

    await discountService.create('enr-1', {
      type: 'scholarship',
      percentage: 20,
      validFrom: '2026-01-01',
    }, 'user-1');

    expect(mockPrisma.billingPeriod.update).not.toHaveBeenCalled();
  });
});
