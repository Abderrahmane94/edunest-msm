import type { BillingPeriod } from '@/hooks/usePayments';

export interface SuggestedAllocation {
  billingPeriodId: string;
  amount: string;
}

/**
 * Distributes a total payment amount across a child's outstanding billing
 * periods, filling each up to its outstanding amount, prioritizing late
 * periods first and then the closest due date. Any remainder left over
 * after every period is fully covered (amount exceeds total outstanding)
 * is folded into the last allocation so the sum always matches `amount`.
 *
 * Pure function shared by the generic "record a payment" flow and the
 * child-creation wizard's payment step.
 */
export function suggestAllocations(
  periods: BillingPeriod[],
  amount: number,
): SuggestedAllocation[] {
  if (!amount || amount <= 0 || periods.length === 0) return [];

  const sorted = [...periods].sort((a, b) => {
    const aLate = a.isLate ? 1 : 0;
    const bLate = b.isLate ? 1 : 0;
    if (aLate !== bLate) return bLate - aLate;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  let remaining = amount;
  const suggested: SuggestedAllocation[] = [];

  for (const period of sorted) {
    if (remaining <= 0) break;

    const outstanding = Number(period.outstanding ?? period.amountDue);
    if (outstanding <= 0) continue;

    const allocAmount = Math.min(remaining, outstanding);
    const rounded = Math.round(allocAmount * 100) / 100;

    if (rounded >= 0.01) {
      suggested.push({ billingPeriodId: period.id, amount: rounded.toFixed(2) });
      remaining = Math.round((remaining - rounded) * 100) / 100;
    }
  }

  if (remaining > 0 && suggested.length > 0) {
    const last = suggested[suggested.length - 1];
    suggested[suggested.length - 1] = {
      ...last,
      amount: (Number(last.amount) + remaining).toFixed(2),
    };
  }

  return suggested;
}

/** Sum of a child's outstanding amount across all non-cancelled, unpaid periods. */
export function totalOutstanding(periods: BillingPeriod[]): number {
  return periods
    .filter((p) => !p.cancelledAt && p.status !== 'paid')
    .reduce((sum, p) => sum + Number(p.outstanding ?? p.amountDue), 0);
}
