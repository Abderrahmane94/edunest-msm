import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createBranchConfigSchema, updateBranchConfigSchema } from './payments.schema';
import { branchConfigController } from './branch-config.controller';

// Mock prisma for controller authorization tests (validateBranchAccess)
vi.mock('../../lib/prisma', () => ({
  default: {
    branch: {
      findUnique: vi.fn().mockResolvedValue({ schoolId: 'school-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    branchBillingConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// --- Schema Validation Tests ---
// Billing cycle/due-day/grace-period/default-fee now live on BranchFee —
// BranchBillingConfig only carries the payment-overdue notification toggle.

describe('createBranchConfigSchema', () => {
  it('accepts an empty object (notification_setting defaults to disabled)', () => {
    const result = createBranchConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notification_setting).toBe('disabled');
    }
  });

  it('accepts notification_setting "enabled"', () => {
    const result = createBranchConfigSchema.safeParse({ notification_setting: 'enabled' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid notification_setting value', () => {
    const result = createBranchConfigSchema.safeParse({ notification_setting: 'sometimes' });
    expect(result.success).toBe(false);
  });
});

describe('updateBranchConfigSchema', () => {
  it('accepts empty object (field is optional)', () => {
    const result = updateBranchConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects an invalid notification_setting value', () => {
    const result = updateBranchConfigSchema.safeParse({ notification_setting: 'maybe' });
    expect(result.success).toBe(false);
  });
});

// --- Controller Authorization Tests ---

describe('branchConfigController authorization', () => {
  function createMockReq(role?: string): Partial<Request> {
    const isSuperAdmin = role === 'super_admin';
    return {
      user: role ? { userId: 'user-1', schoolId: 'school-1', role } as any : undefined,
      tenantScope: role ? {
        schoolId: isSuperAdmin ? null : 'school-1',
        branchId: null,
        isSuperAdmin,
      } : undefined,
      params: { branchId: 'branch-123' },
      body: { notification_setting: 'enabled' },
    };
  }

  function createMockRes(): Partial<Response> {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('returns 403 when user role is "parent"', async () => {
    const req = createMockReq('parent');
    const res = createMockRes();

    await branchConfigController.create(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      }),
    );
  });

  it('returns 403 when user role is "teacher"', async () => {
    const req = createMockReq('teacher');
    const res = createMockRes();

    await branchConfigController.create(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      }),
    );
  });

  it('does not return 403 for "admin" role', async () => {
    const req = createMockReq('admin');
    const res = createMockRes();

    await branchConfigController.create(req as Request, res as Response, next);

    // Should not be 403 — it may fail later (e.g., DB call) but auth passes
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('does not return 403 for "super_admin" role', async () => {
    const req = createMockReq('super_admin');
    const res = createMockRes();

    await branchConfigController.create(req as Request, res as Response, next);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});
