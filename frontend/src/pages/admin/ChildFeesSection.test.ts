import { describe, expect, it } from 'vitest';
import type { BillingPeriod } from '@/hooks/usePayments';
import { groupByFee } from './ChildFeesSection';

function period(dueDate: string, amountDue: number, totalPaid = 0): BillingPeriod {
  return {
    id: dueDate,
    enrollmentId: 'e1',
    periodStart: dueDate,
    periodEnd: dueDate,
    dueDate: `${dueDate}T00:00:00.000Z`,
    graceEndDate: dueDate,
    amountDue: String(amountDue),
    isRegistrationPeriod: false,
    branchFeeId: 'fee1',
    branchFeeName: 'Scolarité',
    branchFeeBillingCycle: 'monthly',
    cancelledAt: null,
    totalPaid: String(totalPaid),
    outstanding: String(amountDue - totalPaid),
  };
}

describe('groupByFee', () => {
  const year = [
    period('2026-09-01', 10000, 10000), // paid
    period('2026-10-01', 10000, 4000), // overdue, partly paid
    period('2026-11-01', 10000), // next upcoming
    period('2026-12-01', 10000), // later — not due yet
    period('2027-01-01', 10000),
  ];

  it('counts overdue balances plus only the next upcoming period', () => {
    const [fee] = groupByFee(year, '2026-10-15');
    expect(fee.amountDue).toBe(6000 + 10000);
    expect(fee.totalPaid).toBe(14000);
    expect(fee.outstanding).toBe(36000);
  });

  it('shows only the next period when nothing is overdue', () => {
    const [fee] = groupByFee([period('2026-09-01', 10000, 10000), period('2026-10-01', 10000), period('2026-11-01', 10000)], '2026-09-15');
    expect(fee.amountDue).toBe(10000);
  });

  it('is zero once every period is paid', () => {
    const [fee] = groupByFee([period('2026-09-01', 10000, 10000)], '2026-10-15');
    expect(fee.amountDue).toBe(0);
  });
});
