import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: {
      deleteMany: vi.fn((args: unknown) => ({ op: 'deleteMany', args })),
      create: vi.fn((args: unknown) => ({ op: 'create', args })),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../lib/session-cutoff', () => ({ cutSessions: vi.fn(), keepToken: vi.fn() }));

import prisma from '../../lib/prisma';
import { authService } from './auth.service';
import { cutSessions } from '../../lib/session-cutoff';

const sha256 = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const db = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  refreshToken: { deleteMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

let hash: string;

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.JWT_ACCESS_SECRET = 'access-secret';
  process.env.JWT_REFRESH_SECRET = 'refresh-secret';
  hash ??= await bcrypt.hash('ancien-mdp', 4);
  db.user.findUnique.mockResolvedValue({ id: 'u1', schoolId: 's1', role: 'admin', mustChangePassword: false, passwordHash: hash });
  db.user.update.mockResolvedValue({});
  db.$transaction.mockResolvedValue([]);
});

describe('authService.changePassword', () => {
  it('asks for the current password', async () => {
    await expect(authService.changePassword('u1', 'nouveau-mdp')).rejects.toMatchObject({ statusCode: 400 });
    await expect(authService.changePassword('u1', 'nouveau-mdp', 'faux')).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('not on a temporary password (first sign-in)', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', schoolId: 's1', role: 'admin', mustChangePassword: true, passwordHash: hash });
    await expect(authService.changePassword('u1', 'nouveau-mdp')).resolves.toHaveProperty('refreshToken');
  });

  it('ends the other sessions but keeps this one going, past its 15 minutes', async () => {
    const { accessToken, refreshToken } = await authService.changePassword('u1', 'nouveau-mdp', 'ancien-mdp');

    // Old sessions removed and the new one saved, together.
    const ops = db.$transaction.mock.calls[0][0] as Array<{ op: string; args: { data?: { token: string } } }>;
    expect(ops.map((o) => o.op)).toEqual(['deleteMany', 'create']);
    expect(ops[1].args.data!.token).toBe(sha256(refreshToken));

    expect(jwt.verify(refreshToken, 'refresh-secret')).toMatchObject({ userId: 'u1', mustChangePassword: false });
    expect(jwt.verify(accessToken, 'access-secret')).toMatchObject({ userId: 'u1', mustChangePassword: false });
    expect(cutSessions).toHaveBeenCalledWith('u1', accessToken);
  });
});
