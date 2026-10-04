import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    child: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { paymentService, PaymentServiceError } from './payments.service';

const mockPrisma = prisma as unknown as {
  child: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const input = {
  childId: 'child-1',
  totalAmount: new Prisma.Decimal(1000),
  channel: 'cash' as const,
  valueDate: new Date('2026-10-01'),
  recordedBy: 'user-1',
  allocations: [{ billingPeriodId: 'bp-1', amount: new Prisma.Decimal(1000) }],
};

describe('paymentService.recordPayment — target child', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  it("checks the child's billing enrollments, not its classroom placements", async () => {
    mockPrisma.child.findUnique.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(paymentService.recordPayment(input as any, 'branch-1')).rejects.toThrow(PaymentServiceError);

    expect(mockPrisma.child.findUnique).toHaveBeenCalledWith({
      where: { id: 'child-1' },
      include: { paymentEnrollments: { select: { id: true } } },
    });
  });

  it('rejects a child with no billing enrollment', async () => {
    // Placed in a class, but never enrolled for billing.
    mockPrisma.child.findUnique.mockResolvedValue({ id: 'child-1', paymentEnrollments: [], enrollments: [{ id: 'ce-1' }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(paymentService.recordPayment(input as any, 'branch-1')).rejects.toThrow(
      'Target child not found or has no enrollments',
    );
  });

  it('accepts a child enrolled for billing even when not placed in any class', async () => {
    mockPrisma.child.findUnique.mockResolvedValue({ id: 'child-1', paymentEnrollments: [{ id: 'enr-1' }], enrollments: [] });

    // Gets past the enrollment check (fails later on the value date, which is the next check).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = paymentService.recordPayment({ ...input, valueDate: new Date('2999-01-01') } as any, 'branch-1');

    await expect(result).rejects.toThrow('Value date cannot be in the future');
  });
});
