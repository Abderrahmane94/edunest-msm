import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn(), update: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/email.service', () => ({
  emailService: { sendPasswordResetEmail: vi.fn() },
}));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(async () => 'new-hash'), compare: vi.fn() } }));

import prisma from '../../lib/prisma';
import { emailService } from '../../services/email.service';
import { authService, AuthError } from './auth.service';

const mockPrisma = prisma as unknown as {
  user: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  passwordResetToken: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  refreshToken: { deleteMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const sendEmail = emailService.sendPasswordResetEmail as ReturnType<typeof vi.fn>;
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const account = (id: string, school: string, language: 'fr' | 'ar' = 'fr') => ({
  id,
  email: 'Fatima@School.dz',
  firstName: 'Fatima',
  preferredLanguage: language,
  school: { name: school },
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FRONTEND_URL = 'https://app.example';
});

describe('password reset', () => {
  describe('sendPasswordResetLinks', () => {
    it('finds the account whatever the case of the email', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await authService.sendPasswordResetLinks(' fatima@school.dz ');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: { equals: 'fatima@school.dz', mode: 'insensitive' } } }),
      );
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('stores only a hash of the link token and emails the link', async () => {
      mockPrisma.user.findMany.mockResolvedValue([account('u1', 'Crèche A', 'ar')]);

      expect(await authService.sendPasswordResetLinks('fatima@school.dz')).toBe(1);

      const [, options] = sendEmail.mock.calls[0];
      const token = new URL(options.resetUrl).searchParams.get('token')!;
      expect(options.resetUrl.startsWith('https://app.example/reset-password/confirm?token=')).toBe(true);
      expect(options).toMatchObject({ firstName: 'Fatima', schoolName: null, expiresInHours: 1 });
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', token: sha256(token) }),
      });
      // Earlier links stop working.
      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', usedAt: null } }),
      );
    });

    it('sends one link per account, naming the school, when the email has several', async () => {
      mockPrisma.user.findMany.mockResolvedValue([account('u1', 'Crèche A'), account('u2', 'Crèche B')]);

      expect(await authService.sendPasswordResetLinks('fatima@school.dz')).toBe(2);

      expect(sendEmail).toHaveBeenCalledTimes(2);
      expect(sendEmail.mock.calls.map(([, o]) => o.schoolName)).toEqual(['Crèche A', 'Crèche B']);
      const tokens = sendEmail.mock.calls.map(([, o]) => new URL(o.resetUrl).searchParams.get('token'));
      expect(new Set(tokens).size).toBe(2);
    });

    it('keeps going when an email fails to send', async () => {
      mockPrisma.user.findMany.mockResolvedValue([account('u1', 'A'), account('u2', 'B')]);
      sendEmail.mockRejectedValueOnce(new Error('provider down'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await authService.sendPasswordResetLinks('fatima@school.dz')).toBe(2);
      expect(sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('requestPasswordReset', () => {
    it('answers at once, without waiting for the accounts lookup or the email', async () => {
      let release!: () => void;
      mockPrisma.user.findMany.mockReturnValue(new Promise((resolve) => (release = () => resolve([]))));

      await expect(authService.requestPasswordReset({ email: 'x@y.dz' })).resolves.toBeUndefined();
      release();
    });
  });

  describe('confirmPasswordReset', () => {
    const stored = (over: Record<string, unknown> = {}) => ({
      id: 't1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      ...over,
    });

    it('looks the link up by its hash, sets the password and clears "must change password"', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(stored());
      mockPrisma.$transaction.mockResolvedValue([]);

      await authService.confirmPasswordReset({ token: 'raw-token', newPassword: 'nouveau-mdp' });

      expect(mockPrisma.passwordResetToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: sha256('raw-token') } }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'new-hash', mustChangePassword: false },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it.each([
      ['an unknown link', null, 'RESET_LINK_INVALID'],
      ['a used link', stored({ usedAt: new Date() }), 'RESET_LINK_USED'],
      ['an expired link', stored({ expiresAt: new Date(Date.now() - 1000) }), 'RESET_LINK_EXPIRED'],
    ])('refuses %s with its own code', async (_label, token, code) => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(token);

      const error = await authService
        .confirmPasswordReset({ token: 'raw-token', newPassword: 'nouveau-mdp' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AuthError);
      expect(error).toMatchObject({ statusCode: 400, code });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('matches the email whatever its case', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(authService.login({ email: 'FATIMA@school.dz', password: 'x' })).rejects.toThrow(AuthError);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { email: { equals: 'FATIMA@school.dz', mode: 'insensitive' }, deletedAt: null },
      });
    });
  });
});
