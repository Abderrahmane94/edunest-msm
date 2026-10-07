import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    child: { findUnique: vi.fn() },
    paymentRecord: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { paymentService, PaymentServiceError } from './payments.service';

const mockPrisma = prisma as unknown as {
  child: { findUnique: ReturnType<typeof vi.fn> };
  paymentRecord: { findUnique: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const CLIENT_ID = '0b6f6c1e-8a1d-4c9e-9a51-6d3f2f7f1a01';

const input = {
  childId: 'child-1',
  totalAmount: new Prisma.Decimal(1000),
  channel: 'cash' as const,
  valueDate: new Date('2026-10-01'),
  recordedBy: 'user-1',
  isCorrection: false as const,
  allocations: [{ billingPeriodId: 'bp-1', amount: new Prisma.Decimal(1000) }],
  clientId: CLIENT_ID,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('recordPayment sent again (offline payments)', () => {
  it('returns the payment already saved with this client id, without recording it again', async () => {
    const saved = { id: 'pay-1', childId: 'child-1', receiptNumber: 'ECO-2026-000001', allocations: [] };
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(saved);

    await expect(paymentService.recordPayment(input, 'branch-1')).resolves.toBe(saved);
    expect(mockPrisma.paymentRecord.findUnique).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID },
      include: { allocations: true },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a client id that belongs to another child', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue({ id: 'pay-1', childId: 'child-2' });

    await expect(paymentService.recordPayment(input, 'branch-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('returns the other send when two sends of the same payment race', async () => {
    const saved = { id: 'pay-1', childId: 'child-1', allocations: [] };
    mockPrisma.paymentRecord.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['client_id'] },
      }),
    );

    await expect(paymentService.recordPayment(input, 'branch-1')).resolves.toBe(saved);
  });

  it('gives a reason the client can explain when the payment is refused', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockPrisma.child.findUnique.mockResolvedValue(null);

    const error = await paymentService.recordPayment(input, 'branch-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentServiceError);
    expect(error).toMatchObject({ reason: 'child_not_enrolled' });
  });
});

describe('getOfflineSnapshot', () => {
  const period = (id: string, amountDue: number, paid: number[], over: Record<string, unknown> = {}) => ({
    id,
    periodStart: new Date('2026-10-01'),
    periodEnd: new Date('2026-10-31'),
    dueDate: new Date('2026-10-05'),
    graceEndDate: new Date('2999-01-01'),
    amountDue: new Prisma.Decimal(amountDue),
    baseAmount: null,
    isRegistrationPeriod: false,
    cancelledAt: null,
    branchFee: { name: 'Mensualité' },
    paymentAllocations: paid.map((a) => ({ amount: new Prisma.Decimal(a) })),
    ...over,
  });

  it('lists every billed child with only the échéances still to pay, and what remains on each', async () => {
    mockPrisma.enrollment.findMany.mockResolvedValue([
      {
        child: { id: 'c2', firstName: 'Yasmine', lastName: 'B' },
        billingPeriods: [period('p1', 5000, [5000]), period('p2', 5000, [2000])],
      },
      { child: { id: 'c1', firstName: 'Adam', lastName: 'K' }, billingPeriods: [period('p3', 3000, [3000])] },
    ]);

    const snapshot = await paymentService.getOfflineSnapshot('branch-1');

    expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 'branch-1', child: { deletedAt: null } } }),
    );
    // Sorted by name; a child with everything paid is still listed.
    expect(snapshot.children.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(snapshot.children[0].periods).toEqual([]);
    expect(snapshot.children[1].periods).toHaveLength(1);
    expect(snapshot.children[1].periods[0]).toMatchObject({
      id: 'p2',
      outstanding: '3000',
      branchFeeName: 'Mensualité',
      isLate: false,
    });
  });

  it('merges a child enrolled several times into one entry', async () => {
    const child = { id: 'c1', firstName: 'Adam', lastName: 'K' };
    mockPrisma.enrollment.findMany.mockResolvedValue([
      { child, billingPeriods: [period('p1', 1000, [])] },
      { child, billingPeriods: [period('p2', 2000, [])] },
    ]);

    const snapshot = await paymentService.getOfflineSnapshot('branch-1');

    expect(snapshot.children).toHaveLength(1);
    expect(snapshot.children[0].periods.map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});
