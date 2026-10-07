import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/email.service', () => ({ emailService: {} }));

import prisma from '../../lib/prisma';
import { authService, AuthError } from './auth.service';

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  school: { findUnique: ReturnType<typeof vi.fn> };
  refreshToken: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_ACCESS_SECRET = 'access-secret';
  process.env.JWT_REFRESH_SECRET = 'refresh-secret';
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'u1',
    schoolId: null,
    role: 'teacher',
    isActive: true,
    mustChangePassword: false,
  });
  mockPrisma.$transaction.mockResolvedValue([]);
});

const refreshToken = () =>
  jwt.sign({ userId: 'u1', schoolId: null, role: 'teacher' }, 'refresh-secret', { expiresIn: '30d' });

const stored = (ageMs: number) => ({
  id: 't1',
  userId: 'u1',
  createdAt: new Date(Date.now() - ageMs),
  expiresAt: new Date(Date.now() + 10 * DAY),
});

describe('refresh', () => {
  it('only renews the access token when the session was extended recently', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(stored(2 * HOUR));

    const result = await authService.refresh({ refreshToken: refreshToken() });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeUndefined();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('extends the session by 30 days once a day, the old token ending after a short grace', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(stored(2 * DAY));

    const result = await authService.refresh({ refreshToken: refreshToken() });

    expect(result.refreshToken).toBeTruthy();
    const created = mockPrisma.refreshToken.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ userId: 'u1', token: result.refreshToken });
    expect(created.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * DAY);

    const ended = mockPrisma.refreshToken.updateMany.mock.calls[0][0];
    expect(ended.where.id).toBe('t1');
    expect(ended.data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(2 * 60 * 1000);
  });

  it('still refuses an expired session', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({ ...stored(40 * DAY), expiresAt: new Date(Date.now() - 1000) });

    await expect(authService.refresh({ refreshToken: refreshToken() })).rejects.toBeInstanceOf(AuthError);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
