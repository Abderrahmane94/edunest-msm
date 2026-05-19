import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

export class BillingError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'BillingError';
  }
}

export const billingService = {

  // ─── Plans ──────────────────────────────────────────────────────────────────

  async listPlans() {
    return prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: 'asc' } });
  },

  async createPlan(input: {
    name: string;
    description?: string;
    priceMonthly: number;
    priceAnnual?: number;
    currency?: string;
    maxChildren?: number;
    maxUsers?: number;
  }) {
    return prisma.subscriptionPlan.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        priceMonthly: input.priceMonthly,
        priceAnnual: input.priceAnnual ?? null,
        currency: input.currency ?? 'DZD',
        maxChildren: input.maxChildren ?? null,
        maxUsers: input.maxUsers ?? null,
      },
    });
  },

  async updatePlan(id: string, input: {
    name?: string;
    description?: string | null;
    priceMonthly?: number;
    priceAnnual?: number | null;
    maxChildren?: number | null;
    maxUsers?: number | null;
    isActive?: boolean;
  }) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new BillingError('Plan not found', 404);
    return prisma.subscriptionPlan.update({ where: { id }, data: input as Prisma.SubscriptionPlanUpdateInput });
  },

  async deletePlan(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new BillingError('Plan not found', 404);
    const count = await prisma.schoolSubscription.count({ where: { planId: id } });
    if (count > 0) throw new BillingError('Cannot delete a plan that has active subscriptions', 400);
    return prisma.subscriptionPlan.delete({ where: { id } });
  },

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  async listSubscriptions() {
    return prisma.schoolSubscription.findMany({
      include: {
        school: { select: { id: true, name: true, wilaya: true, isActive: true } },
        plan: true,
        payments: { orderBy: { paidAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async assignPlan(input: {
    schoolId: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    startDate: string;
    trialDays?: number;
  }) {
    const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
    if (!school) throw new BillingError('School not found', 404);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new BillingError('Plan not found', 404);

    const start = new Date(input.startDate);
    const end = new Date(start);
    if (input.billingCycle === 'annual') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    const trialEndsAt = input.trialDays
      ? new Date(start.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
      : null;

    return prisma.schoolSubscription.upsert({
      where: { schoolId: input.schoolId },
      create: {
        schoolId: input.schoolId,
        planId: input.planId,
        billingCycle: input.billingCycle,
        // trial → free access for X days; no trial → overdue (first payment immediately due)
        status: input.trialDays ? 'trial' : 'overdue',
        currentPeriodStart: start,
        currentPeriodEnd: end,
        trialEndsAt,
      },
      update: {
        planId: input.planId,
        billingCycle: input.billingCycle,
        status: input.trialDays ? 'trial' : 'overdue',
        currentPeriodStart: start,
        currentPeriodEnd: end,
        trialEndsAt,
        cancelledAt: null,
      },
      include: { school: { select: { id: true, name: true } }, plan: true },
    });
  },

  async updateStatus(id: string, status: 'active' | 'overdue' | 'cancelled' | 'suspended') {
    const sub = await prisma.schoolSubscription.findUnique({ where: { id } });
    if (!sub) throw new BillingError('Subscription not found', 404);
    return prisma.schoolSubscription.update({
      where: { id },
      data: {
        status,
        cancelledAt: status === 'cancelled' ? new Date() : undefined,
      },
      include: { school: { select: { id: true, name: true } }, plan: true },
    });
  },

  async recordPayment(subscriptionId: string, input: {
    amount: number;
    periodStart: string;
    periodEnd: string;
    paidAt: string;
    recordedBy: string;
    note?: string;
  }) {
    const sub = await prisma.schoolSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new BillingError('Subscription not found', 404);

    // Block payment only if the subscription is active AND current period hasn't expired yet
    // (overdue subscriptions always allow payment — that's how they become active)
    if (sub.status === 'active' && sub.currentPeriodEnd > new Date()) {
      throw new BillingError(
        `This subscription is already paid until ${sub.currentPeriodEnd.toLocaleDateString()}. ` +
        `You can record the next payment after the current period ends.`,
        400,
      );
    }

    if (sub.status === 'cancelled' || sub.status === 'suspended') {
      throw new BillingError('Cannot record a payment for a cancelled or suspended subscription.', 400);
    }

    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        amount: input.amount,
        currency: 'DZD',
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        paidAt: new Date(input.paidAt),
        recordedBy: input.recordedBy,
        note: input.note ?? null,
      },
    });

    // Auto-advance period and set active
    await prisma.schoolSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        currentPeriodStart: new Date(input.periodStart),
        currentPeriodEnd: new Date(input.periodEnd),
      },
    });

    return payment;
  },

  async getPayments(subscriptionId: string) {
    return prisma.subscriptionPayment.findMany({
      where: { subscriptionId },
      orderBy: { paidAt: 'desc' },
    });
  },

  // ─── Stats ──────────────────────────────────────────────────────────────────

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [subscriptions, revenueThisMonth, totalRevenue] = await Promise.all([
      prisma.schoolSubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.subscriptionPayment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.subscriptionPayment.aggregate({
        _sum: { amount: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    subscriptions.forEach((s) => { statusMap[s.status] = s._count._all; });

    // MRR: sum of monthly equivalent for all active subscriptions
    const activeSubscriptions = await prisma.schoolSubscription.findMany({
      where: { status: { in: ['active', 'trial'] } },
      include: { plan: true },
    });
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      const monthly = sub.billingCycle === 'annual'
        ? Number(sub.plan.priceMonthly)
        : Number(sub.plan.priceMonthly);
      return sum + monthly;
    }, 0);

    return {
      mrr,
      revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
      active: statusMap['active'] ?? 0,
      trial: statusMap['trial'] ?? 0,
      overdue: statusMap['overdue'] ?? 0,
      cancelled: statusMap['cancelled'] ?? 0,
      suspended: statusMap['suspended'] ?? 0,
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
    };
  },
};
