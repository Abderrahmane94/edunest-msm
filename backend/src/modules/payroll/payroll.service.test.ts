import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    salaryPayment: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { payrollService } from './payroll.service';

const mockPrisma = prisma as unknown as {
  salaryPayment: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
};

describe('payrollService.listPayments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.salaryPayment.findMany.mockResolvedValue([]);
    mockPrisma.salaryPayment.count.mockResolvedValue(3);
    mockPrisma.salaryPayment.aggregate.mockResolvedValue({ _sum: { netSalary: new Prisma.Decimal('75500') } });
  });

  it('filters by role and returns the net total of every matching payment', async () => {
    const result = await payrollService.listPayments('school-1', {
      year: 2026,
      role: 'teacher',
      page: 1,
      pageSize: 20,
    });

    const where = { schoolId: 'school-1', deletedAt: null, year: 2026, user: { role: 'teacher' } };
    expect(mockPrisma.salaryPayment.findMany.mock.calls[0][0].where).toEqual(where);
    expect(mockPrisma.salaryPayment.aggregate).toHaveBeenCalledWith({ where, _sum: { netSalary: true } });
    expect(result.total).toBe(3);
    expect(result.totalNet).toBe('75500.00');
  });

  it('filters by payment date range', async () => {
    await payrollService.listPayments('school-1', {
      paidFrom: '2026-09-01',
      paidTo: '2026-09-30',
      page: 1,
      pageSize: 20,
    });

    expect(mockPrisma.salaryPayment.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-1',
      deletedAt: null,
      paidAt: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
    });
  });
});
