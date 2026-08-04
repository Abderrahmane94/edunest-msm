import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  paymentTenancyMiddleware,
  validateBranchAccess,
  validateEnrollmentAccess,
  resolveBranchFilter,
} from './tenant-scope.middleware';

// Mock prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    branch: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
    paymentRecord: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: undefined,
    tenantScope: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('paymentTenancyMiddleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next without tenantScope when no user is authenticated', async () => {
    const req = mockReq();
    const res = mockRes();

    await paymentTenancyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantScope).toBeUndefined();
  });

  it('sets isSuperAdmin=true and skips scoping for super_admin role', async () => {
    const req = mockReq({
      user: { userId: 'u1', schoolId: null, role: 'super_admin' },
    });
    const res = mockRes();

    await paymentTenancyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantScope).toEqual({
      schoolId: null,
      branchId: null,
      isSuperAdmin: true,
    });
  });

  it('rejects non-super_admin without schoolId with 403', async () => {
    const req = mockReq({
      user: { userId: 'u1', schoolId: null, role: 'admin' },
    });
    const res = mockRes();

    await paymentTenancyMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('sets schoolId and branchId for branch-scoped staff', async () => {
    const req = mockReq({
      user: { userId: 'u1', schoolId: 's1', branchId: 'b1', role: 'admin' },
    });
    const res = mockRes();

    await paymentTenancyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantScope).toEqual({
      schoolId: 's1',
      branchId: 'b1',
      isSuperAdmin: false,
    });
  });

  it('sets branchId=null for school-wide staff (null branchId)', async () => {
    const req = mockReq({
      user: { userId: 'u1', schoolId: 's1', branchId: null, role: 'admin' },
    });
    const res = mockRes();

    await paymentTenancyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantScope).toEqual({
      schoolId: 's1',
      branchId: null,
      isSuperAdmin: false,
    });
  });
});

describe('validateBranchAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows super_admin to access any branch', async () => {
    const req = mockReq({
      tenantScope: { schoolId: null, branchId: null, isSuperAdmin: true },
    });
    const res = mockRes();

    const result = await validateBranchAccess('any-branch-id', req, res);

    expect(result).toBe('any-branch-id');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects branch-scoped staff accessing a different branch', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: 'b1', isSuperAdmin: false },
    });
    const res = mockRes();

    const result = await validateBranchAccess('b2', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows branch-scoped staff to access their own branch after school check', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: 'b1', isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findUnique as any).mockResolvedValue({ schoolId: 's1' });

    const result = await validateBranchAccess('b1', req, res);

    expect(result).toBe('b1');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects access to branch from different school (cross-school)', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findUnique as any).mockResolvedValue({ schoolId: 's2' });

    const result = await validateBranchAccess('b-other-school', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects access to non-existent branch (same error as cross-school)', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findUnique as any).mockResolvedValue(null);

    const result = await validateBranchAccess('non-existent', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows school-wide staff to access any branch within their school', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findUnique as any).mockResolvedValue({ schoolId: 's1' });

    const result = await validateBranchAccess('b1', req, res);

    expect(result).toBe('b1');
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('validateEnrollmentAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows super_admin to access any enrollment', async () => {
    const req = mockReq({
      tenantScope: { schoolId: null, branchId: null, isSuperAdmin: true },
    });
    const res = mockRes();

    (prisma.enrollment.findUnique as any).mockResolvedValue({ branchId: 'b1' });

    const result = await validateEnrollmentAccess('e1', req, res);

    expect(result).toBe('b1');
  });

  it('rejects enrollment from different school', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.enrollment.findUnique as any).mockResolvedValue({
      branchId: 'b-other',
      branch: { schoolId: 's2' },
    });

    const result = await validateEnrollmentAccess('e1', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects enrollment from different branch for branch-scoped staff', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: 'b1', isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.enrollment.findUnique as any).mockResolvedValue({
      branchId: 'b2',
      branch: { schoolId: 's1' },
    });

    const result = await validateEnrollmentAccess('e1', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows school-wide staff to access enrollment in any school branch', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.enrollment.findUnique as any).mockResolvedValue({
      branchId: 'b2',
      branch: { schoolId: 's1' },
    });

    const result = await validateEnrollmentAccess('e1', req, res);

    expect(result).toBe('b2');
  });
});

describe('resolveBranchFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('super_admin with no requested branch: returns empty filter (no constraint)', async () => {
    const req = mockReq({
      tenantScope: { schoolId: null, branchId: null, isSuperAdmin: true },
    });
    const res = mockRes();

    const result = await resolveBranchFilter(undefined, req, res);

    expect(result).toEqual({});
  });

  it('super_admin with requested branch: returns that branch', async () => {
    const req = mockReq({
      tenantScope: { schoolId: null, branchId: null, isSuperAdmin: true },
    });
    const res = mockRes();

    const result = await resolveBranchFilter('b1', req, res);

    expect(result).toEqual({ branchId: 'b1' });
  });

  it('branch-scoped staff: always returns their own branch', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: 'b1', isSuperAdmin: false },
    });
    const res = mockRes();

    const result = await resolveBranchFilter(undefined, req, res);

    expect(result).toEqual({ branchId: 'b1' });
  });

  it('branch-scoped staff requesting different branch: rejected', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: 'b1', isSuperAdmin: false },
    });
    const res = mockRes();

    const result = await resolveBranchFilter('b2', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('school-wide staff with requested branch in their school: allowed', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findUnique as any).mockResolvedValue({ schoolId: 's1' });

    const result = await resolveBranchFilter('b1', req, res);

    expect(result).toEqual({ branchId: 'b1' });
  });

  it('school-wide staff with no requested branch: returns all school branches', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findMany as any).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

    const result = await resolveBranchFilter(undefined, req, res);

    expect(result).toEqual({ branchIds: ['b1', 'b2'] });
  });

  it('school-wide staff requesting cross-school branch: rejected', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findUnique as any).mockResolvedValue({ schoolId: 's2' });

    const result = await resolveBranchFilter('b-other-school', req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns empty branchIds when school has no branches (empty list, not error)', async () => {
    const req = mockReq({
      tenantScope: { schoolId: 's1', branchId: null, isSuperAdmin: false },
    });
    const res = mockRes();

    (prisma.branch.findMany as any).mockResolvedValue([]);

    const result = await resolveBranchFilter(undefined, req, res);

    expect(result).toEqual({ branchIds: [] });
    expect(res.status).not.toHaveBeenCalled();
  });
});
