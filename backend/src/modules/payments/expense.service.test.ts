import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    expense: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  },
}));

vi.mock('../../services/cloudinary.service', () => ({ cloudinaryService: {} }));

import prisma from '../../lib/prisma';
import { expenseService } from './expense.service';

const mockPrisma = prisma as unknown as {
  expense: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
};

describe('expenseService.list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.expense.count.mockResolvedValue(0);
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
  });

  it('lists all school expenses, newest first, without filters', async () => {
    await expenseService.list('school-1', 2, 20);

    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-1' },
      skip: 20,
      take: 20,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('applies category, date range, search and receipt filters to the list, count and sum', async () => {
    await expenseService.list('school-1', 1, 20, {
      category: 'supplies',
      from: '2026-09-01',
      to: '2026-09-30',
      search: 'papier',
      hasReceipt: 'true',
    });

    const where = {
      schoolId: 'school-1',
      category: 'supplies',
      date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
      description: { contains: 'papier', mode: 'insensitive' },
      receiptPublicId: { not: null },
    };
    expect(mockPrisma.expense.findMany.mock.calls[0][0].where).toEqual(where);
    expect(mockPrisma.expense.count).toHaveBeenCalledWith({ where });
    expect(mockPrisma.expense.aggregate).toHaveBeenCalledWith({ where, _sum: { amount: true } });
  });

  it('filters expenses without a receipt', async () => {
    await expenseService.list('school-1', 1, 20, { hasReceipt: 'false' });

    expect(mockPrisma.expense.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-1',
      receiptPublicId: null,
    });
  });

  it('returns the total amount of every matching expense', async () => {
    mockPrisma.expense.count.mockResolvedValue(42);
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('12345.5') } });

    const result = await expenseService.list('school-1', 1, 20);

    expect(result.total).toBe(42);
    expect(result.totalAmount).toBe('12345.50');
  });
});
