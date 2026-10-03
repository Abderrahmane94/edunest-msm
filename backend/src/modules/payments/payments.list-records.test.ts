import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    paymentRecord: { findMany: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { paymentService } from './payments.service';

const mockPrisma = prisma as unknown as {
  paymentRecord: { findMany: ReturnType<typeof vi.fn> };
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
});
