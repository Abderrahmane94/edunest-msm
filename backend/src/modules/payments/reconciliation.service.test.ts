import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    paymentRecord: { findMany: vi.fn() },
    branch: { findUnique: vi.fn() },
    expense: { findMany: vi.fn() },
    salaryPayment: { findMany: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { reconciliationService } from './reconciliation.service';

const mockPrisma = prisma as unknown as {
  paymentRecord: { findMany: ReturnType<typeof vi.fn> };
  branch: { findUnique: ReturnType<typeof vi.fn> };
  expense: { findMany: ReturnType<typeof vi.fn> };
  salaryPayment: { findMany: ReturnType<typeof vi.fn> };
};

const dec = (v: string) => new Prisma.Decimal(v);
const start = new Date('2026-09-01');
const end = new Date('2026-09-30');

describe('reconciliationService.generateReport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.branch.findUnique.mockResolvedValue({ schoolId: 'school-1' });
    mockPrisma.paymentRecord.findMany.mockResolvedValue([
      { channel: 'cash', totalAmount: dec('30000.00'), isCorrection: false },
      { channel: 'ccp', totalAmount: dec('15000.00'), isCorrection: false },
      { channel: 'cash', totalAmount: dec('-2000.00'), isCorrection: true },
    ]);
    mockPrisma.expense.findMany.mockResolvedValue([
      { category: 'supplies', amount: dec('4000.00') },
      { category: 'food', amount: dec('6000.00') },
      { category: 'supplies', amount: dec('1000.00') },
    ]);
    mockPrisma.salaryPayment.findMany.mockResolvedValue([
      { netSalary: dec('20000.00') },
    ]);
  });

  it('sets expenses and salaries against income for a net result', async () => {
    const report = await reconciliationService.generateReport('branch-1', start, end);

    expect(report.grandTotal.toFixed(2)).toBe('43000.00');
    expect(report.expenses.total.toFixed(2)).toBe('11000.00');
    expect(report.expenses.count).toBe(3);
    expect(report.salaries.total.toFixed(2)).toBe('20000.00');
    expect(report.salaries.count).toBe(1);
    expect(report.net.toFixed(2)).toBe('12000.00');
  });

  it('groups expenses by category, largest first', async () => {
    const report = await reconciliationService.generateReport('branch-1', start, end);

    expect(report.expenses.byCategory.map((c) => [c.category, c.total.toFixed(2), c.count])).toEqual([
      ['food', '6000.00', 1],
      ['supplies', '5000.00', 2],
    ]);
  });

  it('queries outflows for the branch school and the same date range', async () => {
    await reconciliationService.generateReport('branch-1', start, end);

    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', date: { gte: start, lte: end } },
      select: { category: true, amount: true },
    });
    expect(mockPrisma.salaryPayment.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', deletedAt: null, paidAt: { gte: start, lte: end } },
      select: { netSalary: true },
    });
  });

  it('can come out negative when outflows exceed income', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([]);

    const report = await reconciliationService.generateReport('branch-1', start, end);

    expect(report.net.toFixed(2)).toBe('-31000.00');
  });
});
