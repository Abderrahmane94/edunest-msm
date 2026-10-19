import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    expense: { findUnique: vi.fn(), create: vi.fn() },
    // Run the work on the same client.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn((await import('../../lib/prisma')).default)),
  },
}));
// The history is told apart (expense-history.test.ts).
vi.mock('./expense-history', () => ({
  expenseAuthor: vi.fn().mockResolvedValue({ byUserId: 'user-1', byName: 'Nadia' }),
  snapshotOf: vi.fn().mockResolvedValue({}),
  recordExpenseChange: vi.fn(),
  fieldChanges: vi.fn(),
  toHistoryEntry: vi.fn(),
}));
vi.mock('../../services/cloudinary.service', () => ({ cloudinaryService: {} }));
vi.mock('../academic-years/academic-years.service', () => ({
  academicYearsService: { yearForDate: vi.fn().mockResolvedValue('year-1'), isSchoolYear: vi.fn().mockResolvedValue(true) },
}));

import prisma from '../../lib/prisma';
import { expenseService } from './expense.service';

const mockPrisma = prisma as unknown as {
  expense: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

const input = { category: 'supplies', description: 'Craies', amount: 150, currency: 'DZD', date: '2026-10-13' };
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const duplicate = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test', meta: { target: ['client_id'] } });

describe('an expense sent again is saved once', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.expense.findUnique.mockResolvedValue(null);
    mockPrisma.expense.create.mockResolvedValue({ id: 'exp-new', schoolId: 'school-1' });
  });

  it('records it, with the form id, the first time', async () => {
    const saved = await expenseService.create('school-1', { ...input, clientId: CLIENT_ID }, 'user-1');

    expect(saved).toEqual({ id: 'exp-new', schoolId: 'school-1' });
    expect(mockPrisma.expense.create.mock.calls[0][0].data).toMatchObject({ clientId: CLIENT_ID, schoolId: 'school-1' });
  });

  it('gives back the one already saved under that id, without recording again', async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', schoolId: 'school-1' });

    const saved = await expenseService.create('school-1', { ...input, clientId: CLIENT_ID }, 'user-1');

    expect(saved).toEqual({ id: 'exp-1', schoolId: 'school-1' });
    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
  });

  it('gives back the other send when two sends of the same expense race', async () => {
    mockPrisma.expense.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'exp-1', schoolId: 'school-1' });
    mockPrisma.expense.create.mockRejectedValue(duplicate());

    const saved = await expenseService.create('school-1', { ...input, clientId: CLIENT_ID }, 'user-1');

    expect(saved).toEqual({ id: 'exp-1', schoolId: 'school-1' });
  });

  it("never gives back another school's expense for an id", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: 'exp-1', schoolId: 'school-2' });

    await expect(expenseService.create('school-1', { ...input, clientId: CLIENT_ID }, 'user-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
  });

  it('without an id, records every time (an older site, the stock purchases)', async () => {
    await expenseService.create('school-1', input, 'user-1');
    await expenseService.create('school-1', input, 'user-1');

    expect(mockPrisma.expense.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.expense.create).toHaveBeenCalledTimes(2);
  });
});
