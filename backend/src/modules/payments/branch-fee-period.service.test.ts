import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    branchFee: { findUnique: vi.fn() },
    branchCalendar: { findMany: vi.fn() },
    branchFeePeriod: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { branchFeePeriodService, BranchFeePeriodServiceError } from './branch-fee-period.service';

const mockPrisma = prisma as unknown as {
  branchFee: { findUnique: ReturnType<typeof vi.fn> };
  branchCalendar: { findMany: ReturnType<typeof vi.fn> };
  branchFeePeriod: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('BranchFeePeriodService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  describe('listForFee', () => {
    it('flags periods currently assigned to the fee', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({ id: 'fee-1', branchId: 'branch-1' });
      mockPrisma.branchCalendar.findMany.mockResolvedValue([
        { id: 'period-1' },
        { id: 'period-2' },
      ]);
      mockPrisma.branchFeePeriod.findMany.mockResolvedValue([{ branchCalendarId: 'period-2' }]);

      const result = await branchFeePeriodService.listForFee('fee-1', 'ay-1');

      expect(result.periods).toEqual([
        { id: 'period-1', isAssigned: false },
        { id: 'period-2', isAssigned: true },
      ]);
    });

    it('throws NOT_FOUND when the fee does not exist', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(null);

      await expect(branchFeePeriodService.listForFee('missing', 'ay-1')).rejects.toThrow(
        BranchFeePeriodServiceError,
      );
    });
  });

  describe('setAssignments', () => {
    it('rejects periods that do not belong to the fee\'s branch/year', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({ id: 'fee-1', branchId: 'branch-1' });
      // Only one of the two requested periods actually matches
      mockPrisma.branchCalendar.findMany.mockResolvedValue([{ id: 'period-1' }]);

      await expect(
        branchFeePeriodService.setAssignments('fee-1', 'ay-1', ['period-1', 'period-x']),
      ).rejects.toThrow(BranchFeePeriodServiceError);

      expect(mockPrisma.branchFeePeriod.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces assignments for the given year only', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({ id: 'fee-1', branchId: 'branch-1' });
      mockPrisma.branchCalendar.findMany
        .mockResolvedValueOnce([{ id: 'period-1' }, { id: 'period-2' }]) // validation lookup
        .mockResolvedValueOnce([{ id: 'period-1' }, { id: 'period-2' }]); // final listForFee lookup
      mockPrisma.branchFeePeriod.findMany.mockResolvedValue([
        { branchCalendarId: 'period-1' },
        { branchCalendarId: 'period-2' },
      ]);

      await branchFeePeriodService.setAssignments('fee-1', 'ay-1', ['period-1', 'period-2']);

      expect(mockPrisma.branchFeePeriod.deleteMany).toHaveBeenCalledWith({
        where: { branchFeeId: 'fee-1', branchCalendar: { academicYearId: 'ay-1' } },
      });
      expect(mockPrisma.branchFeePeriod.createMany).toHaveBeenCalledWith({
        data: [
          { branchFeeId: 'fee-1', branchCalendarId: 'period-1' },
          { branchFeeId: 'fee-1', branchCalendarId: 'period-2' },
        ],
      });
    });

    it('clears all assignments for the year when given an empty list', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({ id: 'fee-1', branchId: 'branch-1' });
      mockPrisma.branchCalendar.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.branchFeePeriod.findMany.mockResolvedValue([]);

      await branchFeePeriodService.setAssignments('fee-1', 'ay-1', []);

      expect(mockPrisma.branchFeePeriod.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.branchFeePeriod.createMany).not.toHaveBeenCalled();
    });
  });
});
