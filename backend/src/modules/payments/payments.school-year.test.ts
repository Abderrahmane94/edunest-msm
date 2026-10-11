import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    child: { findUnique: vi.fn() },
    billingPeriod: { findMany: vi.fn() },
    paymentAllocation: { aggregate: vi.fn(), createMany: vi.fn() },
    user: { findUnique: vi.fn() },
    branch: { findUnique: vi.fn() },
    paymentRecord: { create: vi.fn(), findFirst: vi.fn() },
    paymentAuditEntry: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('./receipt-number.util', () => ({ generateReceiptNumber: vi.fn().mockResolvedValue('MAT-2026-000001') }));

import prisma from '../../lib/prisma';
import { paymentService } from './payments.service';

type Mock = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, Mock>> & { $transaction: Mock };

const period = (id: string, academicYearId: string) => ({
  id,
  amountDue: new Prisma.Decimal(500),
  cancelledAt: null,
  enrollment: { childId: 'child-1', academicYearId },
});

const input = (ids: string[]) => ({
  childId: 'child-1',
  totalAmount: new Prisma.Decimal(500 * ids.length),
  channel: 'cash' as const,
  valueDate: new Date('2026-10-01'),
  recordedBy: 'admin-1',
  allocations: ids.map((id) => ({ billingPeriodId: id, amount: new Prisma.Decimal(500) })),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db));
  db.child.findUnique.mockResolvedValue({ id: 'child-1', paymentEnrollments: [{ id: 'enr-1' }] });
  db.paymentAllocation.aggregate.mockResolvedValue({ _sum: { amount: null } });
  db.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  db.branch.findUnique.mockResolvedValue({ id: 'branch-1', name: 'Maternelle' });
  db.paymentRecord.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'pay-1', ...data }));
});

describe('paymentService.recordPayment — one school year per payment', () => {
  it("saves the payment in the year of the échéances it pays", async () => {
    db.billingPeriod.findMany.mockResolvedValue([period('bp-1', 'y26'), period('bp-2', 'y26')]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await paymentService.recordPayment(input(['bp-1', 'bp-2']) as any, 'branch-1').catch(() => undefined);

    expect(db.paymentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ academicYearId: 'y26' }) }),
    );
  });

  it('refuses a payment spread over two school years', async () => {
    db.billingPeriod.findMany.mockResolvedValue([period('bp-1', 'y25'), period('bp-2', 'y26')]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(paymentService.recordPayment(input(['bp-1', 'bp-2']) as any, 'branch-1')).rejects.toMatchObject({
      message: 'A payment can only pay échéances of one school year',
      reason: 'mixed_years',
    });
    expect(db.paymentRecord.create).not.toHaveBeenCalled();
  });
});
