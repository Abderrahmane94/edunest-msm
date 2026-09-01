import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersService, UserServiceError } from './users.service';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    school: {
      findUnique: vi.fn(),
    },
    invitationToken: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../../services/email.service', () => ({
  emailService: {
    sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../../lib/prisma';

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  school: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  invitationToken: {
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $queryRaw: ReturnType<typeof vi.fn>;
};

describe('UsersService', () => {
  const schoolId = 'school-1';
  const email = 'teacher@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invite', () => {
    it('should flag a restorable soft-deleted user instead of sending a fresh invite', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // active check
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'deleted-user-1' }]); // restorable check

      await expect(usersService.invite(email, 'teacher' as any, schoolId)).rejects.toMatchObject({
        statusCode: 409,
        meta: { restorable: true, deletedUserId: 'deleted-user-1' },
      });
      expect(mockPrisma.invitationToken.create).not.toHaveBeenCalled();
    });

    it('should proceed with a normal invite when no user (active or deleted) exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // active check
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // restorable check
      mockPrisma.school.findUnique.mockResolvedValue({ id: schoolId, name: 'Test School' });
      mockPrisma.invitationToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.invitationToken.create.mockResolvedValue({});

      const result = await usersService.invite(email, 'teacher' as any, schoolId);

      expect(result).toEqual({ message: 'Invitation sent successfully' });
      expect(mockPrisma.invitationToken.create).toHaveBeenCalled();
    });

    it('should still reject with the plain "already exists" error when an active user holds the email', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'active-user', email, schoolId, deletedAt: null });

      const error: UserServiceError = await usersService
        .invite(email, 'teacher' as any, schoolId)
        .catch((e) => e);

      expect(error).toMatchObject({ message: 'A user with this email already exists', statusCode: 409 });
      expect(error.meta).toBeUndefined();
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('createDirectly', () => {
    const input = { firstName: 'A', lastName: 'B', email, role: 'teacher', preferredLanguage: 'fr' } as any;

    it('should flag a restorable soft-deleted user instead of creating a duplicate', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'deleted-user-2' }]);

      await expect(usersService.createDirectly(schoolId, input)).rejects.toMatchObject({
        statusCode: 409,
        meta: { restorable: true, deletedUserId: 'deleted-user-2' },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should create the user normally when no soft-deleted record exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user', email, schoolId });

      const result = await usersService.createDirectly(schoolId, input);

      expect(result).toEqual({ id: 'new-user', email, schoolId });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });
});
