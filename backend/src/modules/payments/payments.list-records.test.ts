import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    paymentRecord: { findMany: vi.fn(), aggregate: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { paymentService } from './payments.service';

const mockPrisma = prisma as unknown as {
  paymentRecord: { findMany: ReturnType<typeof vi.fn>; aggregate: ReturnType<typeof vi.fn> };
};

describe('paymentService.listRecords filters', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.paymentRecord.findMany.mockResolvedValue([]);
  });

  it('filters by child, type, fee and receipt number', async () => {
    await paymentService.listRecords('branch-1', {
      childId: 'child-1',
      type: 'correction',
      feeId: 'fee-1',
      receipt: 'mat-2026',
    });

    expect(mockPrisma.paymentRecord.findMany.mock.calls[0][0].where).toEqual({
      branchId: 'branch-1',
      childId: 'child-1',
      isCorrection: true,
      allocations: { some: { billingPeriod: { branchFeeId: 'fee-1' } } },
      receiptNumber: { contains: 'mat-2026', mode: 'insensitive' },
    });
  });

  it('keeps only regular payments for type "payment"', async () => {
    await paymentService.listRecords('branch-1', { type: 'payment' });

    expect(mockPrisma.paymentRecord.findMany.mock.calls[0][0].where).toEqual({
      branchId: 'branch-1',
      isCorrection: false,
    });
  });

  it('without paging gives the whole list (pickers) and asks for no total', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const result = await paymentService.listRecords('branch-1');

    expect(result).toEqual({ records: [{ id: 'p1' }, { id: 'p2' }], total: 2, totalAmount: null });
    expect(mockPrisma.paymentRecord.findMany.mock.calls[0][0].take).toBeUndefined();
    expect(mockPrisma.paymentRecord.aggregate).not.toHaveBeenCalled();
  });

  it('one page at a time, with the count and the sum of everything that matches', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([{ id: 'p26' }]);
    mockPrisma.paymentRecord.aggregate.mockResolvedValue({ _count: { _all: 26 }, _sum: { totalAmount: { toFixed: () => '130500.00' } } });
    const result = await paymentService.listRecords('branch-1', { type: 'payment' }, { page: 2, pageSize: 25 });

    expect(mockPrisma.paymentRecord.findMany.mock.calls[0][0]).toMatchObject({ skip: 25, take: 25 });
    // The total is of the same filter as the page.
    expect(mockPrisma.paymentRecord.aggregate.mock.calls[0][0].where).toEqual(mockPrisma.paymentRecord.findMany.mock.calls[0][0].where);
    expect(result).toEqual({ records: [{ id: 'p26' }], total: 26, totalAmount: '130500.00' });
  });
});
