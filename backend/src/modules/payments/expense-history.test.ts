import { describe, it, expect, vi } from 'vitest';
import { Prisma, type Expense } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({ default: {} }));

import { fieldChanges } from './expense-history';

const years: Record<string, string> = { y25: '2025/2026', y26: '2026/2027' };
const db = {
  academicYear: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ name: years[where.id] })) },
} as never;

const expense = (patch: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  schoolId: 's1',
  category: 'supplies',
  description: 'Craies',
  amount: new Prisma.Decimal('5000'),
  currency: 'DZD',
  date: new Date('2026-10-13'),
  academicYearId: 'y26',
  receiptPublicId: null,
  createdByUserId: 'u1',
  paidFromCashUserId: null,
  cashHandoverId: null,
  clientId: null,
  createdAt: new Date('2026-10-13T08:00:00Z'),
  ...patch,
});

describe('what an edit changed', () => {
  it('tells each changed field, from and to, as shown', async () => {
    const changes = await fieldChanges(
      db,
      expense(),
      expense({ amount: new Prisma.Decimal('15000'), date: new Date('2026-10-12'), academicYearId: 'y25', paidFromCashUserId: 'u1' }),
    );
    expect(changes).toEqual([
      { field: 'amount', from: '5000.00', to: '15000.00' },
      { field: 'date', from: '2026-10-13', to: '2026-10-12' },
      { field: 'academicYear', from: '2026/2027', to: '2025/2026' },
      { field: 'paidFromCash', from: false, to: true },
    ]);
  });

  it('nothing when saved as it was (the same amount written differently included)', async () => {
    expect(await fieldChanges(db, expense(), expense({ amount: new Prisma.Decimal('5000.00') }))).toEqual([]);
  });
});
