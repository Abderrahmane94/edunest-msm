import { Prisma, SubscriptionStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { schoolToday } from './dashboard.service';

/**
 * The platform admin's dashboard: what needs action on subscriptions, the
 * revenue, the schools, and whether schools really use the app.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7;
/** A school with no activity for this long may be about to leave. */
const DORMANT_DAYS = 14;
const ACTIVE_WINDOW_DAYS = 7;
const REVENUE_MONTHS = 12;
const GROWTH_MONTHS = 6;

export type SchoolState = 'none' | SubscriptionStatus | 'disabled';

export type SchoolAlert =
  | 'overdue'
  | 'renewalDue'
  | 'trialEnding'
  | 'noSubscription'
  | 'overLimit'
  | 'dormant';

export interface PlatformSchoolRow {
  id: string;
  name: string;
  wilaya: string;
  isActive: boolean;
  state: SchoolState;
  planName: string | null;
  /** Monthly price of the school's subscription (annual price / 12 when billed yearly). */
  monthlyPrice: number | null;
  /** Price of one billing period (a month, or a year when billed yearly). */
  periodPrice: number | null;
  /** End of the paid period, or of the trial (YYYY-MM-DD). */
  periodEnd: string | null;
  children: number;
  maxChildren: number | null;
  users: number;
  maxUsers: number | null;
  /** Last time anyone of the school used the app (ISO), null if never. */
  lastActiveAt: string | null;
  createdAt: string;
  alerts: SchoolAlert[];
}

export interface PlatformDashboard {
  today: string;
  revenue: {
    mrr: number;
    collectedThisMonth: number;
    collectedPreviousMonth: number;
    /** What the overdue subscriptions owe for one period. */
    overdueAmount: number;
    overdueCount: number;
    monthly: { month: string; collected: number }[];
  };
  schools: {
    total: number;
    byState: Record<SchoolState, number>;
    newThisMonth: number;
    growth: { month: string; created: number }[];
  };
  usage: {
    /** Users who used the app in the last 7 days, per role. */
    activeUsers: { admin: number; teacher: number; parent: number };
    totalUsers: { admin: number; teacher: number; parent: number };
    totalChildren: number;
    /** Platform-wide activity in the last 7 days. */
    lastWeek: { attendance: number; dailyReports: number; messages: number; payments: number };
  };
  /** Schools needing attention first. */
  schoolRows: PlatformSchoolRow[];
}

// ─── Pure calculations ───

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dayString = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

function monthKeys(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = asDate(today.slice(0, 7) + '-01');
    d.setUTCMonth(d.getUTCMonth() - (count - 1 - i));
    return dayString(d).slice(0, 7);
  });
}

export function monthlyPrice(sub: {
  billingCycle: 'monthly' | 'annual';
  plan: { priceMonthly: Prisma.Decimal; priceAnnual: Prisma.Decimal | null };
}): number {
  if (sub.billingCycle === 'annual' && sub.plan.priceAnnual) return round2(Number(sub.plan.priceAnnual) / 12);
  return Number(sub.plan.priceMonthly);
}

export function periodPrice(sub: {
  billingCycle: 'monthly' | 'annual';
  plan: { priceMonthly: Prisma.Decimal; priceAnnual: Prisma.Decimal | null };
}): number {
  if (sub.billingCycle === 'annual') {
    return sub.plan.priceAnnual ? Number(sub.plan.priceAnnual) : round2(Number(sub.plan.priceMonthly) * 12);
  }
  return Number(sub.plan.priceMonthly);
}

/** What a school needs attention for, most urgent first. */
export function schoolAlerts(
  row: Omit<PlatformSchoolRow, 'alerts'>,
  today: string,
): SchoolAlert[] {
  if (!row.isActive) return [];
  const alerts: SchoolAlert[] = [];
  const soon = dayString(new Date(asDate(today).getTime() + SOON_DAYS * DAY_MS));

  if (row.state === 'overdue') alerts.push('overdue');
  // A paid period ending soon (or already over: nothing marks it overdue by itself).
  if (row.state === 'active' && row.periodEnd && row.periodEnd <= soon) alerts.push('renewalDue');
  if (row.state === 'trial' && row.periodEnd && row.periodEnd <= soon) alerts.push('trialEnding');
  if (row.state === 'none') alerts.push('noSubscription');
  if (
    (row.maxChildren != null && row.children > row.maxChildren) ||
    (row.maxUsers != null && row.users > row.maxUsers)
  ) {
    alerts.push('overLimit');
  }
  const dormantSince = asDate(today).getTime() - DORMANT_DAYS * DAY_MS;
  if (!row.lastActiveAt || new Date(row.lastActiveAt).getTime() < dormantSince) alerts.push('dormant');
  return alerts;
}

const ALERT_WEIGHT: Record<SchoolAlert, number> = {
  overdue: 6,
  renewalDue: 5,
  trialEnding: 4,
  overLimit: 3,
  noSubscription: 2,
  dormant: 1,
};

/** Schools needing attention first (most urgent alert), then by name. */
export function sortSchools(rows: PlatformSchoolRow[]): PlatformSchoolRow[] {
  const score = (r: PlatformSchoolRow) => Math.max(0, ...r.alerts.map((a) => ALERT_WEIGHT[a]));
  return [...rows].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

// ─── Data ───

export const platformDashboardService = {
  async getPlatformDashboard(now: Date = new Date()): Promise<PlatformDashboard> {
    const today = schoolToday(now);
    const revenueMonths = monthKeys(today, REVENUE_MONTHS);
    const growthMonths = monthKeys(today, GROWTH_MONTHS);
    const weekAgo = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);
    const live = { deletedAt: null };
    const roles = ['admin', 'teacher', 'parent'] as const;

    const [
      schools,
      childrenBySchool,
      usersBySchool,
      lastActiveBySchool,
      lastSessionBySchool,
      subscriptionPayments,
      activeUserRows,
      usersByRole,
      totalChildren,
      attendance,
      dailyReports,
      messages,
      staffMessages,
      payments,
    ] = await Promise.all([
      prisma.school.findMany({
        select: {
          id: true,
          name: true,
          wilaya: true,
          isActive: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              billingCycle: true,
              currentPeriodEnd: true,
              trialEndsAt: true,
              plan: { select: { name: true, priceMonthly: true, priceAnnual: true, maxChildren: true, maxUsers: true } },
            },
          },
        },
      }),
      // groupBy isn't covered by the soft-delete filter: deleted rows are excluded here.
      prisma.child.groupBy({ by: ['schoolId'], where: { ...live, isActive: true }, _count: { _all: true } }),
      prisma.user.groupBy({
        by: ['schoolId'],
        where: { ...live, isActive: true, role: { not: 'super_admin' } },
        _count: { _all: true },
      }),
      prisma.user.groupBy({ by: ['schoolId'], where: { ...live }, _max: { lastActiveAt: true } }),
      // Sessions opened before the last-activity date existed still count.
      prisma.$queryRaw<{ school_id: string; last: Date }[]>`
        SELECT u.school_id, MAX(t.created_at) AS last
        FROM refresh_tokens t JOIN users u ON u.id = t.user_id
        WHERE u.deleted_at IS NULL AND u.school_id IS NOT NULL
        GROUP BY u.school_id`,
      prisma.subscriptionPayment.findMany({
        where: { deletedAt: null, paidAt: { gte: asDate(`${revenueMonths[0]}-01`) } },
        select: { paidAt: true, amount: true },
      }),
      prisma.user.findMany({
        where: {
          role: { in: [...roles] },
          isActive: true,
          OR: [{ lastActiveAt: { gte: weekAgo } }, { refreshTokens: { some: { createdAt: { gte: weekAgo } } } }],
        },
        select: { role: true },
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: { ...live, isActive: true, role: { in: [...roles] } },
        _count: { _all: true },
      }),
      prisma.child.count({ where: { isActive: true } }),
      prisma.attendanceRecord.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.dailyReport.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.staffMessage.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.paymentRecord.count({ where: { createdAt: { gte: weekAgo }, isCorrection: false } }),
    ]);

    const countOf = (rows: { schoolId: string | null; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.schoolId, r._count._all]));
    const children = countOf(childrenBySchool);
    const users = countOf(usersBySchool);
    const lastActive = new Map<string, number>();
    const bump = (schoolId: string | null, at: Date | null | undefined) => {
      if (!schoolId || !at) return;
      lastActive.set(schoolId, Math.max(lastActive.get(schoolId) ?? 0, new Date(at).getTime()));
    };
    lastActiveBySchool.forEach((r) => bump(r.schoolId, r._max.lastActiveAt));
    lastSessionBySchool.forEach((r) => bump(r.school_id, r.last));

    // Schools
    const rows: PlatformSchoolRow[] = schools.map((s) => {
      const sub = s.subscription;
      const state: SchoolState = !s.isActive ? 'disabled' : sub ? sub.status : 'none';
      const periodEnd = sub
        ? sub.status === 'trial' && sub.trialEndsAt
          ? dayString(sub.trialEndsAt)
          : dayString(sub.currentPeriodEnd)
        : null;
      const last = lastActive.get(s.id);
      const row = {
        id: s.id,
        name: s.name,
        wilaya: s.wilaya,
        isActive: s.isActive,
        state,
        planName: sub?.plan.name ?? null,
        monthlyPrice: sub ? monthlyPrice(sub) : null,
        periodPrice: sub ? periodPrice(sub) : null,
        periodEnd,
        children: children.get(s.id) ?? 0,
        maxChildren: sub?.plan.maxChildren ?? null,
        users: users.get(s.id) ?? 0,
        maxUsers: sub?.plan.maxUsers ?? null,
        lastActiveAt: last ? new Date(last).toISOString() : null,
        createdAt: s.createdAt.toISOString(),
      };
      return { ...row, alerts: schoolAlerts(row, today) };
    });

    const byState: Record<SchoolState, number> = {
      none: 0, trial: 0, active: 0, overdue: 0, cancelled: 0, suspended: 0, disabled: 0,
    };
    rows.forEach((r) => (byState[r.state] += 1));

    // Revenue
    const collected = new Map(revenueMonths.map((m) => [m, 0]));
    for (const p of subscriptionPayments) {
      const month = dayString(p.paidAt).slice(0, 7);
      if (collected.has(month)) collected.set(month, collected.get(month)! + Number(p.amount));
    }
    const monthly = revenueMonths.map((month) => ({ month, collected: round2(collected.get(month)!) }));
    const paying = rows.filter((r) => r.state === 'active');
    const overdue = rows.filter((r) => r.state === 'overdue');

    const growth = growthMonths.map((month) => ({
      month,
      created: rows.filter((r) => r.createdAt.slice(0, 7) === month).length,
    }));

    const perRole = (list: { role: string }[]) =>
      Object.fromEntries(roles.map((role) => [role, list.filter((u) => u.role === role).length])) as Record<
        (typeof roles)[number],
        number
      >;

    return {
      today,
      revenue: {
        mrr: round2(paying.reduce((sum, r) => sum + (r.monthlyPrice ?? 0), 0)),
        collectedThisMonth: monthly[monthly.length - 1].collected,
        collectedPreviousMonth: monthly[monthly.length - 2].collected,
        overdueAmount: round2(overdue.reduce((sum, r) => sum + (r.periodPrice ?? 0), 0)),
        overdueCount: overdue.length,
        monthly,
      },
      schools: {
        total: rows.length,
        byState,
        newThisMonth: growth[growth.length - 1].created,
        growth,
      },
      usage: {
        activeUsers: perRole(activeUserRows),
        totalUsers: Object.fromEntries(
          roles.map((role) => [role, usersByRole.find((r) => r.role === role)?._count._all ?? 0]),
        ) as Record<(typeof roles)[number], number>,
        totalChildren,
        lastWeek: { attendance, dailyReports, messages: messages + staffMessages, payments },
      },
      schoolRows: sortSchools(rows),
    };
  },
};
