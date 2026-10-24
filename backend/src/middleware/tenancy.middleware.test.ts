import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../lib/prisma', () => ({
  default: { user: { findUnique: vi.fn() } },
}));

import prisma from '../lib/prisma';
import { tenancyMiddleware, getCurrentSchoolId } from './tenancy.middleware';

const mockFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

function req(user?: Record<string, unknown>, body?: Record<string, unknown>): Partial<Request> {
  return { user: user as Request['user'], body };
}
function res(): Partial<Response> {
  const r: Partial<Response> = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  return r;
}
const openSchool = { isActive: true, demoExpiresAt: null, trialEndsAt: null };

describe('tenancy middleware — the school comes from the account, not the token', () => {
  let next: NextFunction;
  beforeEach(() => {
    next = vi.fn();
    mockFindUnique.mockReset();
  });

  it('runs the request in the account’s school', async () => {
    mockFindUnique.mockResolvedValue({ isActive: true, role: 'admin', schoolId: 'school-A', school: openSchool });
    const r = res();
    let seen: string | undefined;
    (next as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => { seen = getCurrentSchoolId(); });

    await tenancyMiddleware(req({ userId: 'u1', schoolId: 'school-A', role: 'admin' }) as Request, r as Response, next);

    expect(next).toHaveBeenCalled();
    expect(seen).toBe('school-A');
    expect(r.status).not.toHaveBeenCalled();
  });

  it('rejects a token whose schoolId was changed to another school', async () => {
    // The account belongs to school A; the (tampered) token claims school B.
    mockFindUnique.mockResolvedValue({ isActive: true, role: 'admin', schoolId: 'school-A', school: openSchool });
    const r = res();

    await tenancyMiddleware(req({ userId: 'u1', schoolId: 'school-B', role: 'admin' }) as Request, r as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('rejects a token whose role no longer matches the account', async () => {
    mockFindUnique.mockResolvedValue({ isActive: true, role: 'teacher', schoolId: 'school-A', school: openSchool });
    const r = res();

    await tenancyMiddleware(req({ userId: 'u1', schoolId: 'school-A', role: 'admin' }) as Request, r as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('lets a super_admin through without tenant scoping', async () => {
    mockFindUnique.mockResolvedValue({ isActive: true, role: 'super_admin', schoolId: null, school: null });
    const r = res();

    await tenancyMiddleware(req({ userId: 'u1', schoolId: null, role: 'super_admin' }) as Request, r as Response, next);

    expect(next).toHaveBeenCalled();
    expect(r.status).not.toHaveBeenCalled();
  });

  it('skips unauthenticated (public) requests', async () => {
    const r = res();
    await tenancyMiddleware(req(undefined) as Request, r as Response, next);
    expect(next).toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
