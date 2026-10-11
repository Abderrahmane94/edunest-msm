import { describe, it, expect } from 'vitest';
import type { BillingPeriod } from '@/hooks/usePayments';
import { suggestAllocations, totalOutstanding } from './paymentAllocation';

const period = (id: string, outstanding: string, extra: Partial<BillingPeriod> = {}) =>
  ({ id, outstanding, amountDue: outstanding, dueDate: '2026-10-05', isLate: false, status: 'unpaid', ...extra }) as unknown as BillingPeriod;

describe('totalOutstanding', () => {
  it('stays at 2 decimals however many periods are added', () => {
    // 0.1 + 0.2 style drift: summed as floats this gives 26032.260000000002.
    const periods = [period('a', '1032.26'), period('b', '3000.00'), ...Array.from({ length: 8 }, (_, i) => period(`m${i}`, '2750.00'))];
    const total = totalOutstanding(periods);
    expect(total).toBe(26032.26);
    expect(total.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('leaves out paid and cancelled periods', () => {
    expect(
      totalOutstanding([
        period('a', '100.10'),
        period('b', '50.00', { status: 'paid' }),
        period('c', '70.00', { cancelledAt: '2026-10-01' }),
      ]),
    ).toBe(100.1);
  });

  it('gives allocations that add up to the whole outstanding amount', () => {
    const periods = [period('a', '0.10'), period('b', '0.20'), period('c', '1000.01')];
    const allocations = suggestAllocations(periods, totalOutstanding(periods));
    const sum = allocations.reduce((s, a) => s + Math.round(Number(a.amount) * 100), 0);
    expect(sum).toBe(100031);
  });
});
