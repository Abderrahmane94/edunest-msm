import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), update: vi.fn((args: unknown) => ({ op: 'user.update', args })) },
    refreshToken: { deleteMany: vi.fn((args: unknown) => ({ op: 'refreshToken.deleteMany', args })) },
    pushDevice: { deleteMany: vi.fn((args: unknown) => ({ op: 'pushDevice.deleteMany', args })) },
    passwordResetToken: { updateMany: vi.fn((args: unknown) => ({ op: 'passwordResetToken.updateMany', args })) },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../auth/auth.service', () => ({ authService: { sendPasswordResetLink: vi.fn() } }));

vi.mock('../../lib/linked-accounts', () => ({
  linkedAccountIds: vi.fn(async () => []),
  linkedPassword: vi.fn(async () => null),
}));
import prisma from '../../lib/prisma';
import { usersService, temporaryPassword } from './users.service';
import { authService } from '../auth/auth.service';

const db = prisma as unknown as {
  user: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  refreshToken: { deleteMany: ReturnType<typeof vi.fn> };
  passwordResetToken: { updateMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const admin = { userId: 'admin-1', schoolId: 'school-1' };
const parent = { id: 'parent-1', schoolId: 'school-1', email: 'karim@example.dz', firstName: 'Karim', role: 'parent' };

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findFirst.mockResolvedValue(parent);
  db.$transaction.mockResolvedValue([]);
});

describe('temporaryPassword', () => {
  it('is two groups of four readable characters', () => {
    for (let i = 0; i < 200; i++) {
      const pw = temporaryPassword();
      expect(pw).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it('differs every time', () => {
    const seen = new Set(Array.from({ length: 100 }, () => temporaryPassword()));
    expect(seen.size).toBe(100);
  });
});

describe('usersService.resetPassword', () => {
  it('sets a new password the user must change, and ends their sessions and links', async () => {
    const { temporaryPassword: pw } = await usersService.resetPassword('parent-1', admin);

    expect(db.user.findFirst).toHaveBeenCalledWith({ where: { id: 'parent-1', schoolId: 'school-1' } });
    const ops = db.$transaction.mock.calls[0][0] as { op: string; args: { data?: { passwordHash: string; mustChangePassword: boolean } } }[];
    expect(ops.map((o) => o.op)).toEqual(['user.update', 'refreshToken.deleteMany', 'pushDevice.deleteMany', 'passwordResetToken.updateMany']);
    const data = ops[0].args.data!;
    expect(data.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(pw, data.passwordHash)).toBe(true);
    expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'parent-1' } });
  });

  it('refuses a user of another school', async () => {
    db.user.findFirst.mockResolvedValue(null);

    await expect(usersService.resetPassword('other-1', admin)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses the admin's own account", async () => {
    await expect(usersService.resetPassword('admin-1', admin)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('lets super_admin reset an account of any school', async () => {
    await usersService.resetPassword('parent-1', { userId: 'super-1', schoolId: null });
    expect(db.user.findFirst).toHaveBeenCalledWith({ where: { id: 'parent-1' } });
  });
});

describe('usersService.sendResetLink', () => {
  it('emails the user a reset link', async () => {
    vi.mocked(authService.sendPasswordResetLink).mockResolvedValue(true);

    expect(await usersService.sendResetLink('parent-1', admin)).toEqual({ email: 'karim@example.dz' });
    expect(authService.sendPasswordResetLink).toHaveBeenCalledWith(parent, 1); // the new password is for all the person's accounts: here one
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('says so when the email could not be sent', async () => {
    vi.mocked(authService.sendPasswordResetLink).mockResolvedValue(false);

    await expect(usersService.sendResetLink('parent-1', admin)).rejects.toMatchObject({ statusCode: 502 });
  });
});
