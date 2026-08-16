import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 3: Grace End Date Invariant
 *
 * For any generated billing period, grace_end_date SHALL equal due_date plus
 * the branch's grace_period_days counted as whole calendar days, including
 * when grace_period_days is 0 (in which case grace_end_date equals due_date).
 *
 * **Validates: Requirements 4.6, 5.4**
 */

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function datesEqual(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Generates a date-only value (midnight) within a reasonable range.
 * Avoids time component issues when comparing with service-generated dates.
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

describe('Property 3: Grace End Date Invariant', () => {
  it('grace_end_date equals due_date + grace_period_days for monthly recurring periods', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        (startDate, billingDueDay, gracePeriodDays, recurringFee) => {
          // Ensure endDate is at least 1 month after startDate
          const endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            28
          );

          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearStartDate: startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);

          // Verify grace end date for every recurring period
          for (const period of result.periods) {
            if (!period.isRegistrationPeriod) {
              const expectedGraceEnd = addDays(period.dueDate, gracePeriodDays);
              expect(datesEqual(period.graceEndDate, expectedGraceEnd)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('grace_end_date equals due_date when grace_period_days is 0 for monthly periods', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        (startDate, billingDueDay, recurringFee) => {
          const endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            28
          );

          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearStartDate: startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays: 0,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);

          for (const period of result.periods) {
            if (!period.isRegistrationPeriod) {
              expect(datesEqual(period.graceEndDate, period.dueDate)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('grace_end_date equals start_date + grace_period_days for registration periods', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        (startDate, billingDueDay, gracePeriodDays, recurringFee, registrationFee) => {
          const endDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            28
          );

          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate,
            academicYearStartDate: startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee,
            registrationFee,
            calendarRows: [],
          };

          const result = generatePeriodsForEnrollment(input);
          const regPeriod = result.periods.find((p) => p.isRegistrationPeriod);

          expect(regPeriod).toBeDefined();
          // Registration period dueDate = startDate, so graceEndDate = startDate + gracePeriodDays
          const expectedGraceEnd = addDays(startDate, gracePeriodDays);
          expect(datesEqual(regPeriod!.graceEndDate, expectedGraceEnd)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('grace_end_date equals due_date + grace_period_days for trimester/custom periods', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
        fc.integer({ min: 2020, max: 2028 }).chain((year) =>
          fc
            .tuple(
              fc.integer({ min: 1, max: 28 }),
              fc.integer({ min: 1, max: 28 }),
              fc.integer({ min: 1, max: 28 })
            )
            .map(([due1, due2, due3]) => ({
              year,
              rows: [
                {
                  periodStart: new Date(year, 0, 1),
                  periodEnd: new Date(year, 3, 30),
                  dueDate: new Date(year, 0, due1),
                },
                {
                  periodStart: new Date(year, 4, 1),
                  periodEnd: new Date(year, 7, 31),
                  dueDate: new Date(year, 4, due2),
                },
                {
                  periodStart: new Date(year, 8, 1),
                  periodEnd: new Date(year, 11, 31),
                  dueDate: new Date(year, 8, due3),
                },
              ],
            }))
        ),
        (gracePeriodDays, recurringFee, calData) => {
          const input: GeneratePeriodsInput = {
            enrollmentId: 'test-enr',
            startDate: new Date(calData.year, 0, 1),
            academicYearStartDate: new Date(calData.year, 0, 1),
            academicYearEndDate: new Date(calData.year, 11, 31),
            billingCycle: 'trimester',
            billingDueDay: 10, // not used for trimester
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: calData.rows,
          };

          const result = generatePeriodsForEnrollment(input);

          for (const period of result.periods) {
            if (!period.isRegistrationPeriod) {
              const expectedGraceEnd = addDays(period.dueDate, gracePeriodDays);
              expect(datesEqual(period.graceEndDate, expectedGraceEnd)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
