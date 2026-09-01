import { describe, it, expect, vi, beforeEach } from 'vitest';
import { softDeleteService, SoftDeleteError } from './soft-delete.service';

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  softDeleteStorage: {
    run: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
    getStore: vi.fn(),
  },
}));

import prisma from '../lib/prisma';

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('SoftDeleteService', () => {
  const schoolId = 'school-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('restore', () => {
    it('should restore a soft-deleted record by clearing deletedAt', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', schoolId, deletedAt: new Date() });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', deletedAt: null });

      const result = await softDeleteService.restore('user', 'u1', schoolId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { deletedAt: null },
      });
      expect(result).toEqual({ id: 'u1', deletedAt: null });
    });

    it('should throw 404 when the record does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(softDeleteService.restore('user', 'missing', schoolId)).rejects.toMatchObject({
        message: 'user not found',
        statusCode: 404,
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw 409 when the record is not deleted', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', schoolId, deletedAt: null });

      await expect(softDeleteService.restore('user', 'u1', schoolId)).rejects.toMatchObject({
        message: 'user is not deleted',
        statusCode: 409,
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw a clean 409 when restoring would collide with an active record sharing a unique field', async () => {
      // Reproduces: user A soft-deleted, user B created reusing A's email
      // (allowed since the partial unique index only covers active rows),
      // then restoring A hits the partial unique index on (email, schoolId).
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', schoolId, deletedAt: new Date() });
      const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(softDeleteService.restore('user', 'u1', schoolId)).rejects.toBeInstanceOf(SoftDeleteError);
      await expect(softDeleteService.restore('user', 'u1', schoolId)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should rethrow non-P2002 errors from the update unchanged', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', schoolId, deletedAt: new Date() });
      const unexpectedError = new Error('connection lost');
      mockPrisma.user.update.mockRejectedValue(unexpectedError);

      await expect(softDeleteService.restore('user', 'u1', schoolId)).rejects.toBe(unexpectedError);
    });
  });
});
