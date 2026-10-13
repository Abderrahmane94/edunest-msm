import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => {
  const db = {
    cashHandover: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'h1' })) },
    paymentRecord: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
    expense: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
    user: { findFirst: vi.fn() },
    school: { findUnique: vi.fn(async () => ({ cashAlertAmount: new Prisma.Decimal(50000), cashAlertDays: 3 })) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return { default: db };
});
vi.mock('../access/access.service', () => ({ accessService: { permissionsOf: vi.fn() } }));

import prisma from '../../lib/prisma';
import { cashDesksService, expectedAmount, isDue } from './cash-desks.service';

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, Fn>>;
const d = (n: number) => new Prisma.Decimal(n);
const office = { userId: 'office', role: 'administrative', schoolId: 's1' };
const director = { userId: 'boss', role: 'admin', schoolId: 's1' };
const cashier = { id: 'cashier', firstName: 'Samira', lastName: 'Bureau', role: 'administrative', isActive: true };

/** A desk with a 1000 float, 5000 + 3000 taken, 500 given back, 1200 spent: 7300. */
function desk() {
  db.cashHandover.findFirst.mockResolvedValue({ floatLeft: d(1000), createdAt: new Date('2026-10-01') });
  db.paymentRecord.findMany.mockResolvedValue([
    { id: 'p1', totalAmount: d(5000), createdAt: new Date('2026-10-02'), child: { firstName: 'A', lastName: 'B' } },
    { id: 'p2', totalAmount: d(3000), createdAt: new Date('2026-10-03'), child: { firstName: 'A', lastName: 'B' } },
    { id: 'p3', totalAmount: d(-500), createdAt: new Date('2026-10-03'), child: { firstName: 'A', lastName: 'B' } },
  ]);
  db.expense.findMany.mockResolvedValue([{ id: 'e1', amount: d(1200), createdAt: new Date('2026-10-04') }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findFirst.mockResolvedValue(cashier);
  db.cashHandover.findFirst.mockResolvedValue(null);
  db.cashHandover.create.mockResolvedValue({ id: 'h1' });
  db.paymentRecord.findMany.mockResolvedValue([]);
  db.expense.findMany.mockResolvedValue([]);
});

describe('expectedAmount', () => {
  it('is the float left, plus cash taken, less cash spent', () => {
    expect(expectedAmount(d(1000), d(7500), d(1200)).toNumber()).toBe(7300);
  });
});

describe('isDue', () => {
  const settings = { cashAlertAmount: d(50000), cashAlertDays: 3 };
  const now = new Date('2026-10-10T12:00:00Z');
  it('when the desk holds the limit or more', () => {
    expect(isDue({ expected: d(50000), oldestAt: now }, settings, now)).toBe(true);
    expect(isDue({ expected: d(49999), oldestAt: now }, settings, now)).toBe(false);
  });
  it('when money has been in it for too long', () => {
    expect(isDue({ expected: d(100), oldestAt: new Date('2026-10-07T12:00:00Z') }, settings, now)).toBe(true);
    expect(isDue({ expected: d(100), oldestAt: new Date('2026-10-08T12:00:00Z') }, settings, now)).toBe(false);
  });
  it('never when both limits are 0, nor for an empty desk', () => {
    expect(isDue({ expected: d(900000), oldestAt: new Date('2020-01-01') }, { cashAlertAmount: d(0), cashAlertDays: 0 }, now)).toBe(false);
    expect(isDue({ expected: d(0), oldestAt: null }, settings, now)).toBe(false);
  });
});

describe('collect', () => {
  it('records the count and marks only what was counted', async () => {
    desk();
    await cashDesksService.collect(office, 'cashier', { countedAmount: 7300, floatLeft: 300, expectedAmount: 7300 });
    const data = db.cashHandover.create.mock.calls[0][0].data;
    expect(data.kind).toBe('handover');
    expect(data.expectedAmount.toNumber()).toBe(7300);
    expect(data.cashIn.toNumber()).toBe(7500);
    expect(data.cashOut.toNumber()).toBe(1200);
    expect(data.difference.toNumber()).toBe(0);
    expect(data.floatLeft.toNumber()).toBe(300);
    expect(db.paymentRecord.updateMany.mock.calls[0][0].where.id.in).toEqual(['p1', 'p2', 'p3']);
    expect(db.expense.updateMany.mock.calls[0][0].where.id.in).toEqual(['e1']);
  });

  it('keeps a shortage with its reason, and refuses one without', async () => {
    desk();
    await expect(cashDesksService.collect(office, 'cashier', { countedAmount: 7000, floatLeft: 0, expectedAmount: 7300 })).rejects.toThrow('A reason is required');
    await cashDesksService.collect(office, 'cashier', { countedAmount: 7000, floatLeft: 0, expectedAmount: 7300, reason: ' Erreur de monnaie ' });
    const data = db.cashHandover.create.mock.calls[0][0].data;
    expect(data.difference.toNumber()).toBe(-300);
    expect(data.reason).toBe('Erreur de monnaie');
  });

  it('refuses when the desk changed since the screen was loaded', async () => {
    desk();
    await expect(cashDesksService.collect(office, 'cashier', { countedAmount: 7000, floatLeft: 0, expectedAmount: 7000 })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.cashHandover.create).not.toHaveBeenCalled();
  });

  it('nobody collects their own desk, except a director who deposits it', async () => {
    desk();
    await expect(cashDesksService.collect(office, 'office', { countedAmount: 7300, floatLeft: 0, expectedAmount: 7300 })).rejects.toMatchObject({ statusCode: 403 });
    await cashDesksService.collect(director, 'boss', { countedAmount: 7300, floatLeft: 0, expectedAmount: 7300 });
    expect(db.cashHandover.create.mock.calls[0][0].data.kind).toBe('deposit');
  });

  it('refuses an empty desk and a float above the count', async () => {
    await expect(cashDesksService.collect(office, 'cashier', { countedAmount: 0, floatLeft: 0, expectedAmount: 0 })).rejects.toThrow('nothing to collect');
    desk();
    await expect(cashDesksService.collect(office, 'cashier', { countedAmount: 7300, floatLeft: 8000, expectedAmount: 7300 })).rejects.toThrow('float left');
  });
});
