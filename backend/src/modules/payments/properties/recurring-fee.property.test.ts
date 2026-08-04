import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 4: Recurring Fee as Amount Source
 *
 * For any enrollment and any generated billing period where is_registration_period
 * is false and no first-period override was stated, amount_due SHALL equal the
 * enrollment's recurring_fee value at generation time, expressed with exactly two
 * decimal places.
 *
 * **Validates: Requirements 3.6, 4.8, 4.9**
 */

/**
 * Generates a date-only value (midnight) within a reasonable range.
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
 * Generates a Prisma.Decimal representing a fee with exactly 2 decimal places.
 * Range: 0.01 to 9999999.99
 */
function arbRecurringFee() {
  return fc
    .integer({ min: 1, max: 999999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

describe('Property 4: Recurring Fee as Amount Source', () => {
  it('all non-registration periods have amountDue equal to recurringFee (monthly, no override)', () => {
    fc.assert(
      fc.property(
        arbRecurringFee(),
        arbDateOnly(2020, 2029),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        (recurringFee, startDate, billingDueDay, gracePeriodDays) => {
          // End date at least 1 month after start date
          const endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 2,
            28
          );

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

          // All periods should be non-registration (registrationFee is null)
          const recurringPeriods = result.periods.filter(
            (p) => !p.isRegistrationPeriod
          );

          expect(recurringPeriods.length).toBeGreaterThan(0);

          for (const period of recurringPeriods) {
            // amountDue should equal recurringFee exactly
            expect(period.amountDue.equals(recurringFee)).toBe(true);
            // Verify 2 decimal places
            const decimalPlaces = period.amountDue.decimalPlaces();
            expect(decimalPlaces).toBeLessThanOrEqual(2);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('all non-registration periods have amountDue equal to recurringFee (trimester, no override)', () => {
    fc.assert(
      fc.property(
        arbRecurringFee(),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 2020, max: 2028 }),
        (recurringFee, gracePeriodDays, year) => {
          const calendarRows = [
            {
              periodStart: new Date(year, 0, 1),
              periodEnd: new Date(year, 3, 30),
              dueDate: new Date(year, 0, 10),
            },
            {
              periodStart: new Date(year, 4, 1),
              periodEnd: new Date(year, 7, 31),
              dueDate: new Date(year, 4, 10),
            },
            {
              periodStart: new Date(year, 8, 1),
              periodEnd: new Date(year, 11, 31),
              dueDate: new Date(year, 8, 10),
            },
          ];

          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate: new Date(year, 0, 1),
            academicYearEndDate: new Date(year, 11, 31),
            billingCycle: 'trimester',
            billingDueDay: 10,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows,
          };

          const result = generatePeriodsForEnrollment(input);

          const recurringPeriods = result.periods.filter(
            (p) => !p.isRegistrationPeriod
          );

          expect(recurringPeriods.length).toBe(3);

          for (const period of recurringPeriods) {
            expect(period.amountDue.equals(recurringFee)).toBe(true);
            const decimalPlaces = period.amountDue.decimalPlaces();
            expect(decimalPlaces).toBeLessThanOrEqual(2);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('when firstPeriodAmountDue is provided and startDate > first period start, only the first period differs — all others use recurringFee', () => {
    fc.assert(
      fc.property(
        arbRecurringFee(),
        arbRecurringFee(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 2020, max: 2028 }),
        fc.integer({ min: 1, max: 11 }),
        (recurringFee, firstPeriodAmountDue, billingDueDay, gracePeriodDays, year, startMonth) => {
          // Start date must be AFTER the first day of its month to trigger
          // the first-period override (startDate > first period's periodStart)
          const startDate = new Date(year, startMonth, 15);

          // End date at least 2 months after start for multiple periods
          const endDate = new Date(year, startMonth + 3, 28);

          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            firstPeriodAmountDue,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);

          const recurringPeriods = result.periods.filter(
            (p) => !p.isRegistrationPeriod
          );

          // Must have at least 2 periods to verify the override pattern
          expect(recurringPeriods.length).toBeGreaterThanOrEqual(2);

          // First period should have the override amount
          expect(recurringPeriods[0].amountDue.equals(firstPeriodAmountDue)).toBe(
            true
          );

          // All subsequent periods should use the recurringFee
          for (let i = 1; i < recurringPeriods.length; i++) {
            expect(recurringPeriods[i].amountDue.equals(recurringFee)).toBe(true);
            const decimalPlaces = recurringPeriods[i].amountDue.decimalPlaces();
            expect(decimalPlaces).toBeLessThanOrEqual(2);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('recurring fee with registration present: non-registration periods still use recurringFee', () => {
    fc.assert(
      fc.property(
        arbRecurringFee(),
        arbRecurringFee(),
        arbDateOnly(2020, 2029),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        (recurringFee, registrationFee, startDate, billingDueDay, gracePeriodDays) => {
          const endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 2,
            28
          );

          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);

          const recurringPeriods = result.periods.filter(
            (p) => !p.isRegistrationPeriod
          );
          const regPeriods = result.periods.filter(
            (p) => p.isRegistrationPeriod
          );

          expect(regPeriods.length).toBe(1);
          expect(recurringPeriods.length).toBeGreaterThan(0);

          // Registration period uses registrationFee, NOT recurringFee
          expect(regPeriods[0].amountDue.equals(registrationFee)).toBe(true);

          // All non-registration periods use recurringFee
          for (const period of recurringPeriods) {
            expect(period.amountDue.equals(recurringFee)).toBe(true);
            const decimalPlaces = period.amountDue.decimalPlaces();
            expect(decimalPlaces).toBeLessThanOrEqual(2);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
