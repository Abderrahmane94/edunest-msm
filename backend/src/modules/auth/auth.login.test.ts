import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn(), update: vi.fn() },
    school: { findUnique: vi.fn() },
    refreshToken: { create: vi.fn() },
  },
}));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../lib/phone-accounts', () => ({ accountIdsWithPhone: vi.fn() }));

import prisma from '../../lib/prisma';
import { authService } from './auth.service';
import { accountIdsWithPhone } from '../../lib/phone-accounts';

const db = prisma as unknown as {
  user: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  school: { findUnique: ReturnType<typeof vi.fn> };
  refreshToken: { create: ReturnType<typeof vi.fn> };
};
const byPhone = vi.mocked(accountIdsWithPhone);

let hash: string;
const account = (id: string, schoolId: string | null, email: string | null = null) => ({
  id, schoolId, email, branchId: null, firstName: 'Nadia', lastName: 'K', role: 'admin',
  isActive: true, mustChangePassword: false, passwordHash: hash, lastActiveAt: null,
});

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.JWT_ACCESS_SECRET = 'access-secret';
  process.env.JWT_REFRESH_SECRET = 'refresh-secret';
  hash ??= await bcrypt.hash('secret-123', 4);
  db.school.findUnique.mockResolvedValue({ id: 's1', name: 'Crèche', isActive: true });
  db.refreshToken.create.mockResolvedValue({});
  db.user.update.mockResolvedValue({});
});

describe('login', () => {
  it('signs in with a phone number, however it is written', async () => {
    byPhone.mockResolvedValue(['u1']);
    db.user.findMany.mockResolvedValue([account('u1', 's1')]);
    const result = await authService.login({ email: ' +213 555 12 34 56 ', password: 'secret-123' });
    expect(byPhone).toHaveBeenCalledWith('+213 555 12 34 56');
    expect(result).toMatchObject({ user: { id: 'u1', email: null } });
  });

  it('an email is still looked up as an email', async () => {
    db.user.findMany.mockResolvedValue([account('u1', 's1', 'nadia@example.dz')]);
    await authService.login({ email: 'Nadia@example.dz', password: 'secret-123' });
    expect(byPhone).not.toHaveBeenCalled();
    expect(db.user.findMany).toHaveBeenCalledWith({ where: { email: { equals: 'Nadia@example.dz', mode: 'insensitive' }, deletedAt: null, role: { not: 'staff' } } });
  });

  it('an unknown number is a wrong sign-in, like an unknown email', async () => {
    byPhone.mockResolvedValue([]);
    await expect(authService.login({ email: '0555123456', password: 'secret-123' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('asks for the school, then signs in to the one picked', async () => {
    byPhone.mockResolvedValue(['u1', 'u2']);
    db.user.findMany.mockResolvedValue([account('u1', 's1'), account('u2', 's2')]);
    expect(await authService.login({ email: '0555123456', password: 'secret-123' })).toMatchObject({ choiceRequired: true });
    expect(await authService.login({ email: '0555123456', password: 'secret-123', schoolId: 's2' })).toMatchObject({ user: { id: 'u2' } });
  });

  it('refuses two accounts of one school behind one number', async () => {
    byPhone.mockResolvedValue(['u1', 'u2']);
    db.user.findMany.mockResolvedValue([account('u1', 's1'), account('u2', 's1')]);
    await expect(authService.login({ email: '0555123456', password: 'secret-123' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('never signs in an employee without access to the app', async () => {
    byPhone.mockResolvedValue(['u1']);
    db.user.findMany.mockResolvedValue([]);
    await expect(authService.login({ email: '0550000000', password: 'secret-123' })).rejects.toMatchObject({ statusCode: 401 });
    expect(db.user.findMany).toHaveBeenCalledWith({ where: { id: { in: ['u1'] }, deletedAt: null, role: { not: 'staff' } } });
  });
});
