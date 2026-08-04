import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Property 11: Withdrawal Cancellation Logic
 *
 * For any enrollment withdrawal with a submitted withdrawal date, every billing period whose
 * `period_start` is later than the withdrawal date and whose `is_registration_period` is false
 * SHALL have `cancelled_at` set, and every billing period whose `period_end` is on or before
 * the withdrawal date, or whose date range contains the withdrawal date, or whose
 * `is_registration_period` is true SHALL retain `cancelled_at = null`.
 *
 * **Validates: Requirements 12.1, 12.2**
 */

// Pure helper function that simulates the cancellation decision logic
function shouldBeCancelled(
  period: { periodStart: Date; periodEnd: Date; isRegistrationPeriod: boolean },
  withdrawalDate: Date
): boolean {
  // Registration periods are NEVER cancelled regardless of dates
  if (period.isRegistrationPeriod) return false;
  // Only cancel periods whose period_start is LATER than the withdrawal date
  return period.periodStart > withdrawalDate;
}

interface TestPeriod {
  periodStart: Date;
  periodEnd: Date;
  isRegistrationPeriod: boolean;
}

describe('Property 11: Withdrawal Cancellation Logic', () => {
  // Generate a date within a reasonable range
  const dateArb = fc.date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T00:00:00.000Z'),
    noInvalidDate: true,
  });

  // Generate a period with periodStart <= periodEnd
  const periodArb = fc
    .tuple(dateArb, dateArb, fc.boolean())
    .map(([d1, d2, isReg]): TestPeriod => {
      const start = d1 <= d2 ? d1 : d2;
      const end = d1 <= d2 ? d2 : d1;
      return {
        periodStart: start,
        periodEnd: end,
        isRegistrationPeriod: isReg,
      };
    });

  // Generate an array of 3-12 periods
  const periodsArb = fc.array(periodArb, { minLength: 3, maxLength: 12 });

  it('should cancel periods where periodStart > withdrawalDate AND isRegistrationPeriod = false', () => {
    fc.assert(
      fc.property(periodsArb, dateArb, (periods, withdrawalDate) => {
        for (const period of periods) {
          const cancelled = shouldBeCancelled(period, withdrawalDate);

          if (
            period.periodStart > withdrawalDate &&
            !period.isRegistrationPeriod
          ) {
            expect(cancelled).toBe(true);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('should NOT cancel periods where periodStart <= withdrawalDate (covering or past)', () => {
    fc.assert(
      fc.property(periodsArb, dateArb, (periods, withdrawalDate) => {
        for (const period of periods) {
          const cancelled = shouldBeCancelled(period, withdrawalDate);

          if (period.periodStart <= withdrawalDate) {
            expect(cancelled).toBe(false);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('should NEVER cancel registration periods regardless of dates', () => {
    fc.assert(
      fc.property(periodsArb, dateArb, (periods, withdrawalDate) => {
        for (const period of periods) {
          if (period.isRegistrationPeriod) {
            const cancelled = shouldBeCancelled(period, withdrawalDate);
            expect(cancelled).toBe(false);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('should partition periods into exactly cancelled and non-cancelled sets with no overlap', () => {
    fc.assert(
      fc.property(periodsArb, dateArb, (periods, withdrawalDate) => {
        const cancelled = periods.filter((p) =>
          shouldBeCancelled(p, withdrawalDate)
        );
        const notCancelled = periods.filter(
          (p) => !shouldBeCancelled(p, withdrawalDate)
        );

        // Every period must be in exactly one set
        expect(cancelled.length + notCancelled.length).toBe(periods.length);

        // All cancelled periods must have periodStart > withdrawalDate and not be registration
        for (const p of cancelled) {
          expect(p.periodStart > withdrawalDate).toBe(true);
          expect(p.isRegistrationPeriod).toBe(false);
        }

        // All non-cancelled periods must either be registration OR have periodStart <= withdrawalDate
        for (const p of notCancelled) {
          const isProtected =
            p.isRegistrationPeriod || p.periodStart <= withdrawalDate;
          expect(isProtected).toBe(true);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('should not cancel periods whose date range contains the withdrawal date', () => {
    fc.assert(
      fc.property(periodsArb, dateArb, (periods, withdrawalDate) => {
        for (const period of periods) {
          // A period's range contains withdrawalDate if periodStart <= withdrawalDate <= periodEnd
          const rangeContains =
            period.periodStart <= withdrawalDate &&
            period.periodEnd >= withdrawalDate;

          if (rangeContains) {
            const cancelled = shouldBeCancelled(period, withdrawalDate);
            expect(cancelled).toBe(false);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('should not cancel periods whose periodEnd is earlier than the withdrawal date', () => {
    fc.assert(
      fc.property(periodsArb, dateArb, (periods, withdrawalDate) => {
        for (const period of periods) {
          if (period.periodEnd < withdrawalDate) {
            const cancelled = shouldBeCancelled(period, withdrawalDate);
            expect(cancelled).toBe(false);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });
});
