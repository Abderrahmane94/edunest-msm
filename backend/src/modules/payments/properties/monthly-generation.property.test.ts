import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 2: Monthly Billing Period Generation Boundaries
 *
 * For any valid enrollment with a monthly billing cycle, given a start_date and an
 * Academic_Year end_date, the number of generated recurring billing periods SHALL equal
 * the count of distinct calendar months from the month containing start_date through the
 * month containing end_date inclusive, each period's period_start SHALL be the first day
 * of its month, each period's period_end SHALL be the last day of its month, and each
 * period's due_date day-of-month SHALL equal the branch's billing_due_day.
 *
 * **Validates: Requirements 4.3, 4.4**
 */

function datesEqual(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Helper: count of months between two dates (inclusive).
 * = (endYear * 12 + endMonth) - (startYear * 12 + startMonth) + 1
 */
function countMonthsInclusive(startDate: Date, endDate: Date): number {
  return (
    endDate.getFullYear() * 12 +
    endDate.getMonth() -
    (startDate.getFullYear() * 12 + startDate.getMonth()) +
    1
  );
}

/**
 * Returns the last day of the month for the given year and month (0-indexed).
 */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/**
 * Generates a date-only value (midnight) with day constrained to 1-28 to avoid month overflow.
 */
function arbDateOnly(minYear = 2020, maxYear = 2029) {
  return fc
    .tuple(
      fc.integer({ min: minYear, max: maxYear }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(([year, month, day]) => new Date(year, month, day));
}

/**
 * Generates a pair (startDate, endDate) where endDate is in the same month or later.
 */
function arbStartEndDates() {
  return arbDateOnly(2020, 2029).chain((startDate) => {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();

    // endDate must be >= startDate (at least same month or later)
    // Generate month offset from 0 (same month) to 36 (3 years later max)
    return fc
      .integer({ min: 0, max: 36 })
      .map((monthOffset) => {
        const endMonth = (startMonth + monthOffset) % 12;
        const endYear = startYear + Math.floor((startMonth + monthOffset) / 12);
        // Use day 28 to avoid edge cases with short months
        const endDate = new Date(endYear, endMonth, 28);
        return { startDate, endDate };
      });
  });
}

describe('Property 2: Monthly Billing Period Generation Boundaries', () => {
  it('number of generated recurring periods equals count of distinct calendar months from startDate month through endDate month inclusive', () => {
    fc.assert(
      fc.property(
        arbStartEndDates(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        ({ startDate, endDate }, billingDueDay, gracePeriodDays, recurringFee) => {
          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);
          const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

          const expectedCount = countMonthsInclusive(startDate, endDate);
          expect(recurringPeriods.length).toBe(expectedCount);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('each period\'s period_start is the first day of its month', () => {
    fc.assert(
      fc.property(
        arbStartEndDates(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        ({ startDate, endDate }, billingDueDay, gracePeriodDays, recurringFee) => {
          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);
          const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

          for (const period of recurringPeriods) {
            const expectedStart = new Date(
              period.periodStart.getFullYear(),
              period.periodStart.getMonth(),
              1
            );
            expect(datesEqual(period.periodStart, expectedStart)).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('each period\'s period_end is the last day of its month', () => {
    fc.assert(
      fc.property(
        arbStartEndDates(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        ({ startDate, endDate }, billingDueDay, gracePeriodDays, recurringFee) => {
          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);
          const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

          for (const period of recurringPeriods) {
            const expectedEnd = lastDayOfMonth(
              period.periodEnd.getFullYear(),
              period.periodEnd.getMonth()
            );
            expect(datesEqual(period.periodEnd, expectedEnd)).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('each period\'s due_date day-of-month equals billingDueDay', () => {
    fc.assert(
      fc.property(
        arbStartEndDates(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        ({ startDate, endDate }, billingDueDay, gracePeriodDays, recurringFee) => {
          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);
          const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

          for (const period of recurringPeriods) {
            expect(period.dueDate.getDate()).toBe(billingDueDay);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
