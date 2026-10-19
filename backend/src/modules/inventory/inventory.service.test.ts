import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => {
  const db = {
    stockItem: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    stockMovement: { create: vi.fn(), count: vi.fn() },
    expense: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return { default: db };
});
// The expense's history is told apart (expense-history.ts).
vi.mock('../payments/expense-history', () => ({
  expenseAuthor: vi.fn().mockResolvedValue({ byUserId: 'u1', byName: 'Nadia' }),
  snapshotOf: vi.fn().mockResolvedValue({}),
  recordExpenseChange: vi.fn(),
}));
vi.mock('../academic-years/academic-years.service', () => ({
  academicYearsService: { yearForDate: vi.fn().mockResolvedValue('y26') },
}));

import prisma from '../../lib/prisma';
import { inventoryService } from './inventory.service';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;
const D = (n: number) => new Prisma.Decimal(n);
const item = { id: 'i1', schoolId: 's1', name: 'Couches', unit: 'paquet', quantity: D(5), alertThreshold: D(2), isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  db.stockItem.findFirst.mockResolvedValue(item);
  db.stockItem.findUniqueOrThrow.mockResolvedValue(item);
  db.stockMovement.create.mockImplementation(async ({ data }: { data: unknown }) => data);
  db.expense.create.mockResolvedValue({ id: 'e1' });
});

const stockSetTo = () => (db.stockItem.update.mock.calls[0][0] as { data: { quantity: Prisma.Decimal } }).data.quantity.toNumber();

describe('recordMovement', () => {
  it('a purchase adds to the stock and records the expense in the same year', async () => {
    const { movement } = await inventoryService.recordMovement('i1', 's1', 'u1', 'admin', {
      type: 'purchase', quantity: 10, date: '2026-10-11', expense: { amount: 4500, category: 'supplies' },
    });
    expect(stockSetTo()).toBe(15);
    expect(db.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: 'Couches — 10 paquet', academicYearId: 'y26' }),
    }));
    expect(movement).toMatchObject({ type: 'purchase', expenseId: 'e1', academicYearId: 'y26' });
  });

  it('a use takes from the stock, never below zero', async () => {
    await inventoryService.recordMovement('i1', 's1', 'u2', 'teacher', { type: 'use', quantity: 2, date: '2026-10-11' });
    expect(stockSetTo()).toBe(3);
    await expect(
      inventoryService.recordMovement('i1', 's1', 'u2', 'teacher', { type: 'use', quantity: 6, date: '2026-10-11' }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Not enough in stock (5 paquet left)' });
  });

  it('a count sets the stock and records the difference', async () => {
    const { movement } = await inventoryService.recordMovement('i1', 's1', 'u1', 'admin', { type: 'adjustment', quantity: 3, date: '2026-10-11' });
    expect(stockSetTo()).toBe(3);
    expect((movement as unknown as { quantity: Prisma.Decimal }).quantity.toNumber()).toBe(-2);
  });

  it('the administrative staff buy without recording the expense', async () => {
    await expect(
      inventoryService.recordMovement('i1', 's1', 'u3', 'administrative', {
        type: 'purchase', quantity: 1, date: '2026-10-11', expense: { amount: 100, category: 'supplies' },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await inventoryService.recordMovement('i1', 's1', 'u3', 'administrative', { type: 'purchase', quantity: 1, date: '2026-10-11' });
    expect(db.expense.create).not.toHaveBeenCalled();
    expect(stockSetTo()).toBe(6);
  });

  it('teachers record uses only', async () => {
    await expect(
      inventoryService.recordMovement('i1', 's1', 'u2', 'teacher', { type: 'purchase', quantity: 1, date: '2026-10-11' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.stockItem.update).not.toHaveBeenCalled();
  });
});

describe('lowCount', () => {
  it('counts the supplies at or below their threshold', async () => {
    db.stockItem.findMany.mockResolvedValue([
      { quantity: D(2), alertThreshold: D(2), isActive: true },
      { quantity: D(3), alertThreshold: D(2), isActive: true },
      { quantity: D(0), alertThreshold: D(1), isActive: true },
    ]);
    expect(await inventoryService.lowCount('s1')).toBe(2);
  });
});
