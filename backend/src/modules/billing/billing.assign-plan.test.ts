import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    school: { findUnique: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn() },
    schoolSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { billingService } from './billing.service';

const mockPrisma = prisma as unknown as {
  school: { findUnique: ReturnType<typeof vi.fn> };
  subscriptionPlan: { findUnique: ReturnType<typeof vi.fn> };
  schoolSubscription: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
};

const ymd = (d: Date) => d.toISOString().split('T')[0];

describe('billingService.assignPlan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1', isActive: true });
    mockPrisma.schoolSubscription.findUnique.mockResolvedValue(null);
    mockPrisma.schoolSubscription.upsert.mockImplementation(async (args) => args.create);
  });

  it('starts the first billed period when the free trial ends', async () => {
    const sub = await billingService.assignPlan({
      schoolId: 'school-1',
      planId: 'plan-1',
      billingCycle: 'monthly',
      startDate: '2026-10-01',
      trialDays: 30,
    });

    expect(sub.status).toBe('trial');
    expect(ymd(sub.trialEndsAt)).toBe('2026-10-31');
    expect(ymd(sub.currentPeriodStart)).toBe('2026-10-31');
    expect(ymd(sub.currentPeriodEnd)).toBe('2026-12-01');
  });

  it('bills from the start date when there is no trial', async () => {
    const sub = await billingService.assignPlan({
      schoolId: 'school-1',
      planId: 'plan-1',
      billingCycle: 'annual',
      startDate: '2026-10-01',
    });

    expect(sub.status).toBe('overdue');
    expect(sub.trialEndsAt).toBeNull();
    expect(ymd(sub.currentPeriodStart)).toBe('2026-10-01');
    expect(ymd(sub.currentPeriodEnd)).toBe('2027-10-01');
  });
});
