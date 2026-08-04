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
    billingPeriod: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// --- Schema Validation Tests ---

describe('createBranchConfigSchema', () => {
  const validPayload = {
    billing_cycle: 'monthly',
    billing_due_day: 15,
    grace_period_days: 5,
    default_recurring_fee: 100.00,
  };

  describe('billing_cycle enum validation', () => {
    it('accepts "monthly"', () => {
      const result = createBranchConfigSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('accepts "trimester"', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_cycle: 'trimester',
      });
      expect(result.success).toBe(true);
    });

    it('accepts "custom"', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_cycle: 'custom',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid billing_cycle value', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_cycle: 'weekly',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('billing_due_day range', () => {
    it('rejects 0 (below minimum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_due_day: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects 29 (above maximum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_due_day: 29,
      });
      expect(result.success).toBe(false);
    });

    it('accepts 1 (minimum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_due_day: 1,
      });
      expect(result.success).toBe(true);
    });

    it('accepts 28 (maximum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_due_day: 28,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-integer value', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        billing_due_day: 15.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('grace_period_days default and range', () => {
    it('defaults to 5 when omitted', () => {
      const { grace_period_days, ...withoutGrace } = validPayload;
      const result = createBranchConfigSchema.safeParse(withoutGrace);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.grace_period_days).toBe(5);
      }
    });

    it('rejects -1 (below minimum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        grace_period_days: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects 61 (above maximum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        grace_period_days: 61,
      });
      expect(result.success).toBe(false);
    });

    it('accepts 0 (minimum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        grace_period_days: 0,
      });
      expect(result.success).toBe(true);
    });

    it('accepts 60 (maximum)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        grace_period_days: 60,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('default_recurring_fee precision', () => {
    it('rejects 3 decimal places (100.123)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        default_recurring_fee: 100.123,
      });
      expect(result.success).toBe(false);
    });

    it('accepts 2 decimal places (100.12)', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        default_recurring_fee: 100.12,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative amount', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        default_recurring_fee: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects amount exceeding 9999999.99', () => {
      const result = createBranchConfigSchema.safeParse({
        ...validPayload,
        default_recurring_fee: 10000000,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('updateBranchConfigSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateBranchConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates billing_due_day range when provided', () => {
    const result = updateBranchConfigSchema.safeParse({ billing_due_day: 0 });
    expect(result.success).toBe(false);
  });

  it('validates fee precision when provided', () => {
    const result = updateBranchConfigSchema.safeParse({
      default_recurring_fee: 100.123,
    });
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
      body: {
        billing_cycle: 'monthly',
        billing_due_day: 15,
        grace_period_days: 5,
        default_recurring_fee: 100.00,
      },
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
