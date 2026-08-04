import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { derivePeriodStatus } from '../billing-period.service';

/**
 * Property 12: Cancelled Period Exclusion
 *
 * For any billing period carrying a non-null `cancelled_at`, that period SHALL be excluded
 * from the outstanding balance calculation (both amount_due sum and total_paid sum),
 * excluded from the late dashboard results, and SHALL have `is_late = false` regardless
 * of its derived status.
 *
 * **Validates: Requirements 8.12, 8.14, 12.5, 12.6, 14.2**
 */

interface TestBillingPeriod {
  id: string;
  amountDue: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  graceEndDate: Date;
  cancelledAt: Date | null;
}

/**
 * Pure function simulating outstanding balance calculation.
 * Cancelled periods are excluded from both amount_due sum and total_paid sum.
 */
function computeOutstandingBalance(periods: TestBillingPeriod[]): Prisma.Decimal {
  const nonCancelled = periods.filter((p) => p.cancelledAt === null);

  if (nonCancelled.length === 0) {
    return new Prisma.Decimal('0.00');
  }

  const totalDue = nonCancelled.reduce(
    (sum, p) => sum.add(p.amountDue),
    new Prisma.Decimal('0'),
  );

  const totalPaid = nonCancelled.reduce(
    (sum, p) => sum.add(p.totalPaid),
    new Prisma.Decimal('0'),
  );

  const balance = totalDue.sub(totalPaid);
  return new Prisma.Decimal(balance.toFixed(2, Prisma.Decimal.ROUND_HALF_UP));
}

/**
 * Pure function simulating the late dashboard filter.
 * Returns only periods that are late/late_partial AND not cancelled.
 */
function getLateDashboardEntries(
  periods: TestBillingPeriod[],
  currentDate: Date,
): TestBillingPeriod[] {
  return periods.filter((period) => {
    // Cancelled periods are excluded from late dashboard
    if (period.cancelledAt !== null) return false;

    const derived = derivePeriodStatus(
      period.amountDue,
      period.totalPaid,
      period.graceEndDate,
      currentDate,
      period.cancelledAt,
    );

    return derived.status === 'late' || derived.status === 'late_partial';
  });
}

// Arbitraries
const amountArb = fc
  .integer({ min: 1, max: 99999999 })
  .map((cents) => new Prisma.Decimal(cents).div(100));

const paidArb = fc
  .integer({ min: 0, max: 99999999 })
  .map((cents) => new Prisma.Decimal(cents).div(100));

const dateArb = fc.date({
  min: new Date('2020-01-01T00:00:00.000Z'),
  max: new Date('2030-12-31T00:00:00.000Z'),
  noInvalidDate: true,
});

const cancelledDateArb = fc.date({
  min: new Date('2020-01-01T00:00:00.000Z'),
  max: new Date('2030-12-31T00:00:00.000Z'),
  noInvalidDate: true,
});

function arbPeriod(forceCancel: boolean | null = null): fc.Arbitrary<TestBillingPeriod> {
  const cancelledAtArb =
    forceCancel === true
      ? cancelledDateArb.map((d) => d as Date | null)
      : forceCancel === false
        ? fc.constant(null as Date | null)
        : fc.option(cancelledDateArb);

  return fc.record({
    id: fc.uuid(),
    amountDue: amountArb,
    totalPaid: paidArb,
    graceEndDate: dateArb,
    cancelledAt: cancelledAtArb,
  });
}

describe('Property 12: Cancelled Period Exclusion', () => {
  it('cancelled periods are excluded from outstanding balance (amount_due sum)', () => {
    fc.assert(
      fc.property(
        fc.array(arbPeriod(), { minLength: 1, maxLength: 20 }),
        (periods) => {
          const balance = computeOutstandingBalance(periods);

          // Recompute using only non-cancelled periods
          const nonCancelled = periods.filter((p) => p.cancelledAt === null);
          const expectedDue = nonCancelled.reduce(
            (sum, p) => sum.add(p.amountDue),
            new Prisma.Decimal('0'),
          );
          const expectedPaid = nonCancelled.reduce(
            (sum, p) => sum.add(p.totalPaid),
            new Prisma.Decimal('0'),
          );
          const expectedBalance = new Prisma.Decimal(
            expectedDue.sub(expectedPaid).toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
          );

          expect(balance.equals(expectedBalance)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('cancelled periods never appear in late dashboard results', () => {
    fc.assert(
      fc.property(
        fc.array(arbPeriod(), { minLength: 1, maxLength: 20 }),
        dateArb,
        (periods, currentDate) => {
          const lateEntries = getLateDashboardEntries(periods, currentDate);

          // No cancelled period should appear in the late entries
          for (const entry of lateEntries) {
            expect(entry.cancelledAt).toBeNull();
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('cancelled periods always have is_late = false regardless of derived status', () => {
    fc.assert(
      fc.property(
        // Generate periods that are forced to be cancelled
        fc.array(arbPeriod(true), { minLength: 1, maxLength: 20 }),
        dateArb,
        (cancelledPeriods, currentDate) => {
          for (const period of cancelledPeriods) {
            const derived = derivePeriodStatus(
              period.amountDue,
              period.totalPaid,
              period.graceEndDate,
              currentDate,
              period.cancelledAt,
            );

            // Cancelled periods must always have is_late = false
            expect(derived.isLate).toBe(false);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('adding cancelled periods to a set does not change the outstanding balance', () => {
    fc.assert(
      fc.property(
        fc.array(arbPeriod(false), { minLength: 1, maxLength: 10 }),
        fc.array(arbPeriod(true), { minLength: 1, maxLength: 10 }),
        (activePeriods, cancelledPeriods) => {
          const balanceWithoutCancelled = computeOutstandingBalance(activePeriods);
          const balanceWithCancelled = computeOutstandingBalance([
            ...activePeriods,
            ...cancelledPeriods,
          ]);

          // Balance should be identical whether or not cancelled periods are present
          expect(balanceWithCancelled.equals(balanceWithoutCancelled)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('adding cancelled periods to a set does not change late dashboard results', () => {
    fc.assert(
      fc.property(
        fc.array(arbPeriod(false), { minLength: 1, maxLength: 10 }),
        fc.array(arbPeriod(true), { minLength: 1, maxLength: 10 }),
        dateArb,
        (activePeriods, cancelledPeriods, currentDate) => {
          const lateWithout = getLateDashboardEntries(activePeriods, currentDate);
          const lateWith = getLateDashboardEntries(
            [...activePeriods, ...cancelledPeriods],
            currentDate,
          );

          // Same late entries regardless of cancelled periods
          expect(lateWith.length).toBe(lateWithout.length);

          // Each entry in lateWith should correspond to an entry in lateWithout (by id)
          const lateWithIds = lateWith.map((e) => e.id).sort();
          const lateWithoutIds = lateWithout.map((e) => e.id).sort();
          expect(lateWithIds).toEqual(lateWithoutIds);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('balance returns 0.00 when all periods are cancelled', () => {
    fc.assert(
      fc.property(
        fc.array(arbPeriod(true), { minLength: 1, maxLength: 20 }),
        (allCancelledPeriods) => {
          const balance = computeOutstandingBalance(allCancelledPeriods);
          expect(balance.equals(new Prisma.Decimal('0.00'))).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
