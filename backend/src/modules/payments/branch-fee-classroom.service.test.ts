import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    branchFee: { findUnique: vi.fn(), findMany: vi.fn() },
    classroom: { findMany: vi.fn(), findUnique: vi.fn() },
    branchFeeClassroom: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { branchFeeClassroomService, BranchFeeClassroomServiceError } from './branch-fee-classroom.service';

const mockPrisma = prisma as unknown as {
  branchFee: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  classroom: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  branchFeeClassroom: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('BranchFeeClassroomService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  describe('listForFee', () => {
    it('flags classrooms currently linked to the fee', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-1',
        branchId: 'branch-1',
        branch: { schoolId: 'school-1' },
      });
      mockPrisma.classroom.findMany.mockResolvedValue([
        { id: 'class-1', name: 'A' },
        { id: 'class-2', name: 'B' },
      ]);
      mockPrisma.branchFeeClassroom.findMany.mockResolvedValue([{ classroomId: 'class-2' }]);

      const result = await branchFeeClassroomService.listForFee('fee-1');

      expect(result.classrooms).toEqual([
        { id: 'class-1', name: 'A', isLinked: false },
        { id: 'class-2', name: 'B', isLinked: true },
      ]);
    });

    it('throws NOT_FOUND when the fee does not exist', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue(null);

      await expect(branchFeeClassroomService.listForFee('missing')).rejects.toThrow(
        BranchFeeClassroomServiceError,
      );
    });
  });

  describe('setClassrooms', () => {
    it('rejects classrooms that do not belong to the fee\'s school', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-1',
        branchId: 'branch-1',
        branch: { schoolId: 'school-1' },
      });
      // Only one of the two requested classrooms actually matches
      mockPrisma.classroom.findMany.mockResolvedValue([{ id: 'class-1' }]);

      await expect(
        branchFeeClassroomService.setClassrooms('fee-1', ['class-1', 'class-x']),
      ).rejects.toThrow(BranchFeeClassroomServiceError);

      expect(mockPrisma.branchFeeClassroom.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces classroom links', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-1',
        branchId: 'branch-1',
        branch: { schoolId: 'school-1' },
      });
      mockPrisma.classroom.findMany
        .mockResolvedValueOnce([{ id: 'class-1' }, { id: 'class-2' }]) // validation lookup
        .mockResolvedValueOnce([{ id: 'class-1' }, { id: 'class-2' }]); // final listForFee lookup
      mockPrisma.branchFeeClassroom.findMany.mockResolvedValue([
        { classroomId: 'class-1' },
        { classroomId: 'class-2' },
      ]);

      await branchFeeClassroomService.setClassrooms('fee-1', ['class-1', 'class-2']);

      expect(mockPrisma.branchFeeClassroom.deleteMany).toHaveBeenCalledWith({
        where: { branchFeeId: 'fee-1' },
      });
      expect(mockPrisma.branchFeeClassroom.createMany).toHaveBeenCalledWith({
        data: [
          { branchFeeId: 'fee-1', classroomId: 'class-1' },
          { branchFeeId: 'fee-1', classroomId: 'class-2' },
        ],
      });
    });

    it('clears all links when given an empty list', async () => {
      mockPrisma.branchFee.findUnique.mockResolvedValue({
        id: 'fee-1',
        branchId: 'branch-1',
        branch: { schoolId: 'school-1' },
      });
      mockPrisma.classroom.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.branchFeeClassroom.findMany.mockResolvedValue([]);

      await branchFeeClassroomService.setClassrooms('fee-1', []);

      expect(mockPrisma.branchFeeClassroom.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.branchFeeClassroom.createMany).not.toHaveBeenCalled();
    });
  });

  describe('listFeesForClassroom', () => {
    it('returns fees linked to the classroom or with no classroom links at all', async () => {
      mockPrisma.classroom.findUnique.mockResolvedValue({ id: 'class-1', schoolId: 'school-1' });
      mockPrisma.branchFee.findMany.mockResolvedValue([
        { id: 'fee-linked', name: 'Uniform' },
        { id: 'fee-general', name: 'Tuition' },
      ]);

      const result = await branchFeeClassroomService.listFeesForClassroom('class-1');

      expect(result.fees).toHaveLength(2);
      expect(mockPrisma.branchFee.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          branch: { schoolId: 'school-1' },
          OR: [
            { classroomAssignments: { some: { classroomId: 'class-1' } } },
            { classroomAssignments: { none: {} } },
          ],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('throws NOT_FOUND when the classroom does not exist', async () => {
      mockPrisma.classroom.findUnique.mockResolvedValue(null);

      await expect(branchFeeClassroomService.listFeesForClassroom('missing')).rejects.toThrow(
        BranchFeeClassroomServiceError,
      );
    });
  });
});
