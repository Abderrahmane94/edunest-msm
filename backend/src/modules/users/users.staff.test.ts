import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: { user: { findFirst: vi.fn(), create: vi.fn() } },
}));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../auth/auth.service', () => ({ authService: {} }));
vi.mock('../../lib/phone-accounts', () => ({ accountIdsWithPhone: vi.fn().mockResolvedValue(['someone']) }));

vi.mock('../../lib/linked-accounts', () => ({
  linkedAccountIds: vi.fn(async () => []),
  linkedPassword: vi.fn(async () => null),
}));
import prisma from '../../lib/prisma';
import { usersService } from './users.service';
import { accountIdsWithPhone } from '../../lib/phone-accounts';

const db = prisma as unknown as { user: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } };

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findFirst.mockResolvedValue(null);
  db.user.create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'u1', ...data }));
});

describe('an employee without access to the app (staff)', () => {
  it('is created without email nor a password to give', async () => {
    const user = await usersService.createDirectly('s1', {
      firstName: 'Fatiha', lastName: 'Mansouri', role: 'staff', email: 'ignored@example.dz', phone: '0550 00 00 00', preferredLanguage: 'fr',
    });
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'staff', email: null, mustChangePassword: false }),
    }));
    expect(user.temporaryPassword).toBeNull();
    // Their number is not a sign-in: another account may have it.
    expect(accountIdsWithPhone).not.toHaveBeenCalled();
  });

  it('an account that signs in still gets its temporary password', async () => {
    vi.mocked(accountIdsWithPhone).mockResolvedValueOnce([]);
    const user = await usersService.createDirectly('s1', { firstName: 'Samia', lastName: 'Bel', role: 'teacher', phone: '0661 00 00 00', preferredLanguage: 'fr' });
    expect(user.temporaryPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  });

  it('gets no password from the office either', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'u1', role: 'staff', schoolId: 's1' });
    await expect(usersService.resetPassword('u1', { userId: 'admin', schoolId: 's1' })).rejects.toMatchObject({ statusCode: 400 });
  });
});
