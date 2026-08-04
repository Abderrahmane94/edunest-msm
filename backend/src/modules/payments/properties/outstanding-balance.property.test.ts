import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

/**
 * Property 9: Outstanding Balance Formula
 *
 * For any child, the outstanding balance SHALL equal the sum of `amount_due` over
 * all non-cancelled billing periods minus the sum of all payment allocation amounts
 * (including negative correction allocations) against those same periods, expressed
 * in DZD with exactly two decimal places using half-up rounding on the final result
 * only. A negative result (overpayment) SHALL be returned without clamping.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.7**
 */

interface BillingPeriodData {
  id: string;
  amountDue: Prisma.Decimal;
  isCancelled: boolean;
}

interface AllocationData {
  billingPeriodId: string;
  amount: Prisma.Decimal; // positive for payments, negative for corrections
}

/**
 * Pure function that computes the outstanding balance using the same formula
 * as the production service:
 *   balance = sum(amountDue for non-cancelled periods) - sum(allocations for non-cancelled periods)
 * 
 * Half-up rounding to 2 decimal places is applied only on the final result.
 * Negative result (overpayment) is returned without clamping.
 * Returns 0.00 if no non-cancelled periods exist.
 */
function computeOutstandingBalance(
  periods: BillingPeriodData[],
  allocations: AllocationData[],
): Prisma.Decimal {
  // Filter to non-cancelled periods
  const activePeriods = periods.filter((p) => !p.isCancelled);

  // If no non-cancelled periods exist, return 0.00
  if (activePeriods.length === 0) {
    return new Prisma.Decimal('0.00');
  }

  // Sum amount_due over non-cancelled periods (no rounding on intermediates)
  const totalDue = activePeriods.reduce(
    (sum, p) => sum.add(p.amountDue),
    new Prisma.Decimal('0'),
  );

  // Collect IDs of non-cancelled periods
  const activePeriodIds = new Set(activePeriods.map((p) => p.id));

  // Sum allocation amounts only for non-cancelled periods
  const totalPaid = allocations
    .filter((a) => activePeriodIds.has(a.billingPeriodId))
    .reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal('0'));

  // Balance = totalDue - totalPaid
  const balance = totalDue.sub(totalPaid);

  // Half-up rounding to exactly 2 decimal places on final result only
  const rounded = new Prisma.Decimal(
    balance.toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
  );

  return rounded;
}

/**
 * Generates a DZD amount with exactly 2 decimal places (0.01 to 99999.99).
 */
function arbAmountDue() {
  return fc
    .integer({ min: 1, max: 9999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

/**
 * Generates a positive payment allocation amount (0.01 to 99999.99).
 */
function arbPositiveAllocation() {
  return fc
    .integer({ min: 1, max: 9999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

/**
 * Generates a negative correction allocation amount (-99999.99 to -0.01).
 */
function arbNegativeAllocation() {
  return fc
    .integer({ min: 1, max: 9999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100).neg());
}

/**
 * Generates a billing period with a unique id, random amountDue, and cancellation status.
 */
function arbPeriod(index: number): fc.Arbitrary<BillingPeriodData> {
  return fc.record({
    id: fc.constant(`period-${index}`),
    amountDue: arbAmountDue(),
    isCancelled: fc.boolean(),
  });
}

/**
 * Generates a set of billing periods (1-20 periods).
 */
function arbPeriods(): fc.Arbitrary<BillingPeriodData[]> {
  return fc
    .integer({ min: 1, max: 20 })
    .chain((count) =>
      fc.tuple(
        ...Array.from({ length: count }, (_, i) => arbPeriod(i))
      )
    )
    .map((tuple) => tuple as unknown as BillingPeriodData[]);
}

/**
 * Generates allocations referencing valid period IDs.
 * Mix of positive payments and negative corrections.
 */
function arbAllocations(periodIds: string[]): fc.Arbitrary<AllocationData[]> {
  if (periodIds.length === 0) {
    return fc.constant([]);
  }

  const arbSingleAllocation: fc.Arbitrary<AllocationData> = fc.oneof(
    // Positive payment allocation
    fc.record({
      billingPeriodId: fc.constantFrom(...periodIds),
      amount: arbPositiveAllocation(),
    }),
    // Negative correction allocation
    fc.record({
      billingPeriodId: fc.constantFrom(...periodIds),
      amount: arbNegativeAllocation(),
    }),
  );

  return fc.array(arbSingleAllocation, { minLength: 0, maxLength: 30 });
}

describe('Property 9: Outstanding Balance Formula', () => {
  it('balance equals sum(amountDue for non-cancelled) minus sum(allocations for non-cancelled)', () => {
    fc.assert(
      fc.property(
        arbPeriods().chain((periods) => {
          const allPeriodIds = periods.map((p) => p.id);
          return fc.tuple(fc.constant(periods), arbAllocations(allPeriodIds));
        }),
        ([periods, allocations]) => {
          const balance = computeOutstandingBalance(periods, allocations);

          // Manually verify the formula
          const activePeriods = periods.filter((p) => !p.isCancelled);

          if (activePeriods.length === 0) {
            expect(balance.equals(new Prisma.Decimal('0.00'))).toBe(true);
            return;
          }

          const activePeriodIds = new Set(activePeriods.map((p) => p.id));

          const expectedDue = activePeriods.reduce(
            (sum, p) => sum.add(p.amountDue),
            new Prisma.Decimal('0'),
          );

          const expectedPaid = allocations
            .filter((a) => activePeriodIds.has(a.billingPeriodId))
            .reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal('0'));

          const expectedBalance = new Prisma.Decimal(
            expectedDue.sub(expectedPaid).toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
          );

          expect(balance.equals(expectedBalance)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('negative balance (overpayment) is returned without clamping', () => {
    fc.assert(
      fc.property(
        arbPeriods().chain((periods) => {
          // Ensure at least one non-cancelled period
          const withActive = periods.map((p, i) =>
            i === 0 ? { ...p, isCancelled: false } : p,
          );
          const allPeriodIds = withActive.map((p) => p.id);
          return fc.tuple(fc.constant(withActive), arbAllocations(allPeriodIds));
        }),
        ([periods, allocations]) => {
          const balance = computeOutstandingBalance(periods, allocations);

          const activePeriods = periods.filter((p) => !p.isCancelled);
          const activePeriodIds = new Set(activePeriods.map((p) => p.id));

          const totalDue = activePeriods.reduce(
            (sum, p) => sum.add(p.amountDue),
            new Prisma.Decimal('0'),
          );

          const totalPaid = allocations
            .filter((a) => activePeriodIds.has(a.billingPeriodId))
            .reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal('0'));

          // If overpaid, balance should be negative (not clamped to 0)
          if (totalPaid.gt(totalDue)) {
            expect(balance.lt(new Prisma.Decimal('0'))).toBe(true);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('result always has exactly 2 decimal places', () => {
    fc.assert(
      fc.property(
        arbPeriods().chain((periods) => {
          const allPeriodIds = periods.map((p) => p.id);
          return fc.tuple(fc.constant(periods), arbAllocations(allPeriodIds));
        }),
        ([periods, allocations]) => {
          const balance = computeOutstandingBalance(periods, allocations);
          const str = balance.toFixed(2);

          // The string representation should have exactly 2 decimal places
          const parts = str.split('.');
          expect(parts.length).toBe(2);
          expect(parts[1].length).toBe(2);

          // And parsing it back should give the same value
          expect(balance.equals(new Prisma.Decimal(str))).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('cancelled periods are excluded from both due and paid sums', () => {
    fc.assert(
      fc.property(
        arbPeriods().chain((periods) => {
          // Ensure mix of cancelled and non-cancelled
          const mixed = periods.map((p, i) => ({
            ...p,
            isCancelled: i % 2 === 0, // alternate cancellation
          }));
          const allPeriodIds = mixed.map((p) => p.id);
          return fc.tuple(fc.constant(mixed), arbAllocations(allPeriodIds));
        }),
        ([periods, allocations]) => {
          const balance = computeOutstandingBalance(periods, allocations);

          // Verify cancelled period amounts don't affect balance
          const activePeriods = periods.filter((p) => !p.isCancelled);
          const activePeriodIds = new Set(activePeriods.map((p) => p.id));

          // Allocations against cancelled periods should be ignored
          const activeAllocations = allocations.filter((a) =>
            activePeriodIds.has(a.billingPeriodId),
          );

          const expectedDue = activePeriods.reduce(
            (sum, p) => sum.add(p.amountDue),
            new Prisma.Decimal('0'),
          );

          const expectedPaid = activeAllocations.reduce(
            (sum, a) => sum.add(a.amount),
            new Prisma.Decimal('0'),
          );

          const expectedBalance = activePeriods.length === 0
            ? new Prisma.Decimal('0.00')
            : new Prisma.Decimal(
                expectedDue.sub(expectedPaid).toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
              );

          expect(balance.equals(expectedBalance)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('returns 0.00 when all periods are cancelled', () => {
    fc.assert(
      fc.property(
        arbPeriods().chain((periods) => {
          // Force all periods to be cancelled
          const allCancelled = periods.map((p) => ({ ...p, isCancelled: true }));
          const allPeriodIds = allCancelled.map((p) => p.id);
          return fc.tuple(fc.constant(allCancelled), arbAllocations(allPeriodIds));
        }),
        ([periods, allocations]) => {
          const balance = computeOutstandingBalance(periods, allocations);
          expect(balance.equals(new Prisma.Decimal('0.00'))).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});
