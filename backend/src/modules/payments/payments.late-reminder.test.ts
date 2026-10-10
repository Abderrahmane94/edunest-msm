import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    billingPeriod: { findUnique: vi.fn() },
    notification: { findFirst: vi.fn() },
  },
}));

vi.mock('../../services/notification.service', () => ({
  notificationService: { notify: vi.fn() },
}));

import prisma from '../../lib/prisma';
import { notificationService } from '../../services/notification.service';
import { paymentService, lateReminderMessage } from './payments.service';

const mockPrisma = prisma as unknown as {
  billingPeriod: { findUnique: ReturnType<typeof vi.fn> };
  notification: { findFirst: ReturnType<typeof vi.fn> };
};
const notify = notificationService.notify as ReturnType<typeof vi.fn>;

const DAY = 86_400_000;

function latePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bp-1',
    amountDue: new Prisma.Decimal(2000),
    periodStart: new Date('2026-09-01'),
    graceEndDate: new Date(Date.now() - 10 * DAY),
    cancelledAt: null,
    isRegistrationPeriod: false,
    branchFee: { name: 'Mensualité' },
    paymentAllocations: [{ amount: new Prisma.Decimal(500) }],
    enrollment: {
      child: {
        firstName: 'Rayan',
        lastName: 'Lounis',
        parentLinks: [
          { isPrimary: true, parent: { id: 'p-1', preferredLanguage: 'fr' } },
          { isPrimary: false, parent: { id: 'p-2', preferredLanguage: 'ar' } },
        ],
      },
    },
    ...overrides,
  };
}

describe('paymentService.sendLateReminder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.notification.findFirst.mockResolvedValue(null);
  });

  it('notifies every parent in their language, with SMS only to the primary one', async () => {
    mockPrisma.billingPeriod.findUnique.mockResolvedValue(latePeriod());

    const result = await paymentService.sendLateReminder('bp-1');

    expect(result.sentTo).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
    const [primary] = notify.mock.calls.find(([p]) => p.userId === 'p-1')!;
    const [other] = notify.mock.calls.find(([p]) => p.userId === 'p-2')!;
    expect(primary.channels).toEqual(['push', 'email', 'sms']);
    expect(other.channels).toEqual(['push', 'email']);
    expect(primary.body).toContain('1 500,00⁩ DA');
    expect(primary.body).toContain('Mensualité');
    expect(other.title).toBe('تذكير بالدفع');
    expect(primary.referenceId).toBe('bp-1');
  });

  it('refuses a period that is not late', async () => {
    mockPrisma.billingPeriod.findUnique.mockResolvedValue(
      latePeriod({ graceEndDate: new Date(Date.now() + 5 * DAY) }),
    );
    await expect(paymentService.sendLateReminder('bp-1')).rejects.toMatchObject({ code: 'NOT_LATE' });
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends at most one reminder per period per day', async () => {
    mockPrisma.billingPeriod.findUnique.mockResolvedValue(latePeriod());
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'n-1' });
    await expect(paymentService.sendLateReminder('bp-1')).rejects.toMatchObject({ code: 'ALREADY_REMINDED' });
    expect(notify).not.toHaveBeenCalled();
  });

  it('reports a child without linked parents', async () => {
    const period = latePeriod();
    period.enrollment.child.parentLinks = [];
    mockPrisma.billingPeriod.findUnique.mockResolvedValue(period);
    await expect(paymentService.sendLateReminder('bp-1')).rejects.toMatchObject({ code: 'NO_PARENTS' });
  });
});

describe('lateReminderMessage', () => {
  it('names the registration fee when the period has no fee', () => {
    const msg = lateReminderMessage('fr', {
      childName: 'Adam Boudiaf',
      feeName: null,
      periodLabel: '9/2026',
      outstanding: '2000.00',
      daysLate: 1,
    });
    expect(msg.body).toContain("frais d'inscription");
    expect(msg.body).toContain('1 jour.');
  });

  it('isolates inserted names so mixed Arabic/French text keeps its order', () => {
    const msg = lateReminderMessage('fr', {
      childName: 'Rayan Lounis',
      feeName: 'الاشتراك الشهري',
      periodLabel: '9/2026',
      outstanding: '733.33',
      daysLate: 30,
    });
    expect(msg.body).toContain('« ⁨الاشتراك الشهري⁩ »');
    expect(msg.body).toContain('⁨Rayan Lounis⁩');
    expect(msg.body).toContain('⁨733,33⁩ DA');
  });

  it.each([
    [1, 'منذ يوم واحد'],
    [2, 'منذ يومين'],
    [4, 'منذ 4 أيام'],
    [10, 'منذ 10 أيام'],
    [30, 'منذ 30 يومًا'],
  ])('counts %i days in correct Arabic', (daysLate, expected) => {
    const msg = lateReminderMessage('ar', {
      childName: 'Adam Boudiaf',
      feeName: null,
      periodLabel: '9/2026',
      outstanding: '2000',
      daysLate,
    });
    expect(msg.body).toContain(`متأخر ${expected}.`);
    expect(msg.body).toContain('⁨2 000,00⁩ د.ج');
  });
});
