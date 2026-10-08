import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  monthlyPrice,
  periodPrice,
  schoolAlerts,
  sortSchools,
  type PlatformSchoolRow,
} from './platform-dashboard.service';

const TODAY = '2026-10-08';

const school = (over: Partial<PlatformSchoolRow> = {}): Omit<PlatformSchoolRow, 'alerts'> => ({
  id: 's1',
  name: 'École',
  wilaya: 'Alger',
  isActive: true,
  state: 'active',
  planName: 'Standard',
  monthlyPrice: 5000,
  periodPrice: 5000,
  periodEnd: '2026-11-30',
  children: 40,
  maxChildren: 50,
  users: 10,
  maxUsers: 20,
  lastActiveAt: '2026-10-07T09:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('schoolAlerts', () => {
  it('has nothing to say about a paying, active school within its limits', () => {
    expect(schoolAlerts(school(), TODAY)).toEqual([]);
  });

  it('flags overdue payments, and paid periods ending within 7 days or already over', () => {
    expect(schoolAlerts(school({ state: 'overdue' }), TODAY)).toEqual(['overdue']);
    expect(schoolAlerts(school({ periodEnd: '2026-10-14' }), TODAY)).toEqual(['renewalDue']);
    expect(schoolAlerts(school({ periodEnd: '2026-09-30' }), TODAY)).toEqual(['renewalDue']);
    expect(schoolAlerts(school({ periodEnd: '2026-10-20' }), TODAY)).toEqual([]);
  });

  it('flags trials ending soon and schools without a subscription', () => {
    expect(schoolAlerts(school({ state: 'trial', periodEnd: '2026-10-12' }), TODAY)).toEqual(['trialEnding']);
    expect(schoolAlerts(school({ state: 'none', periodEnd: null, maxChildren: null, maxUsers: null }), TODAY)).toEqual([
      'noSubscription',
    ]);
  });

  it("flags a school over its plan's limits", () => {
    expect(schoolAlerts(school({ children: 51 }), TODAY)).toEqual(['overLimit']);
    expect(schoolAlerts(school({ users: 21 }), TODAY)).toEqual(['overLimit']);
  });

  it('flags a school nobody has used for 14 days, or ever', () => {
    expect(schoolAlerts(school({ lastActiveAt: '2026-09-20T09:00:00.000Z' }), TODAY)).toEqual(['dormant']);
    expect(schoolAlerts(school({ lastActiveAt: null }), TODAY)).toEqual(['dormant']);
  });

  it('says nothing about a disabled school', () => {
    expect(schoolAlerts(school({ isActive: false, state: 'disabled', lastActiveAt: null }), TODAY)).toEqual([]);
  });
});

describe('sortSchools', () => {
  it('puts the most urgent first, then sorts by name', () => {
    const rows = [
      { ...school({ id: 'a', name: 'Alpha' }), alerts: [] },
      { ...school({ id: 'b', name: 'Beta' }), alerts: ['dormant' as const] },
      { ...school({ id: 'c', name: 'Gamma' }), alerts: ['overdue' as const] },
      { ...school({ id: 'd', name: 'Delta' }), alerts: ['dormant' as const] },
    ];
    expect(sortSchools(rows).map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});

describe('prices', () => {
  const plan = { priceMonthly: new Prisma.Decimal(5000), priceAnnual: new Prisma.Decimal(54000) };

  it('gives the monthly value and the price of one billing period', () => {
    expect(monthlyPrice({ billingCycle: 'monthly', plan })).toBe(5000);
    expect(monthlyPrice({ billingCycle: 'annual', plan })).toBe(4500);
    expect(periodPrice({ billingCycle: 'annual', plan })).toBe(54000);
    expect(periodPrice({ billingCycle: 'annual', plan: { ...plan, priceAnnual: null } })).toBe(60000);
  });
});
