import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('../../services/email.service', () => ({ emailService: {} }));

import prisma from '../../lib/prisma';
import { usersService } from './users.service';

const mockPrisma = prisma as unknown as {
  user: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

describe('usersService.list filters', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
  });

  it('matches every search word against name, email or phone', async () => {
    await usersService.list('school-1', 1, 10, ' nadia  benmansour ');

    const match = (word: string) => ({
      OR: [
        { firstName: { contains: word, mode: 'insensitive' } },
        { lastName: { contains: word, mode: 'insensitive' } },
        { email: { contains: word, mode: 'insensitive' } },
        { phone: { contains: word } },
      ],
    });
    expect(mockPrisma.user.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-1',
      role: { not: 'super_admin' },
      AND: [match('nadia'), match('benmansour')],
    });
  });

  it('filters by role and status', async () => {
    await usersService.list('school-1', 1, 10, undefined, 'createdAt', 'desc', {
      role: 'teacher',
      status: 'inactive',
    });

    const where = { schoolId: 'school-1', role: 'teacher', isActive: false };
    expect(mockPrisma.user.findMany.mock.calls[0][0].where).toEqual(where);
    expect(mockPrisma.user.count).toHaveBeenCalledWith({ where });
  });
});
