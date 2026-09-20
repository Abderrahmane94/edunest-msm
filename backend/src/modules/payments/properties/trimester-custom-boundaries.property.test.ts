import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 17: Custom Cycle Period Boundaries From Calendar
 *
 * For any enrollment at a branch with a `custom` billing cycle, the
 * generated billing periods' `period_start` and `period_end` values SHALL
 * match exactly the corresponding BranchCalendar rows (for rows whose
 * `period_end` >= enrollment `start_date`), taken in ascending `period_start`
 * order with no date transformation. `due_date` is not stored on the
 * calendar row — it is derived from the fee's `billing_due_day`, anchored to
 * the month each period starts in.
 *
 * **Validates: Requirements 2.2, 4.5**
 */

function datesEqual(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Generates a date-only value (midnight) constrained to days 1-28.
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
 * Resolves the expected due date for a period: the fee's billing_due_day,
 * anchored to the month the period starts in — mirrors dueDateForPeriod in
 * billing-period.service.ts.
 */
function expectedDueDate(periodStart: Date, billingDueDay: number): Date {
  return new Date(periodStart.getFullYear(), periodStart.getMonth(), billingDueDay);
}

/**
 * Generates 1-6 calendar rows for custom cycle. Some rows may have periodEnd < startDate
 * (those will be filtered out), but at least 1 row will have periodEnd >= startDate.
 */
function arbCustomInput() {
  return fc
    .tuple(
      arbDateOnly(2020, 2025),
      fc.integer({ min: 0, max: 60 }),
      fc.integer({ min: 1, max: 28 }),
      fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100)),
      fc.integer({ min: 1, max: 6 })
    )
    .chain(([startDate, gracePeriodDays, billingDueDay, recurringFee, rowCount]) => {
      // Generate rowCount non-overlapping rows, ensuring at least 1 has periodEnd >= startDate
      return fc
        .tuple(
          fc.array(fc.integer({ min: 20, max: 90 }), { minLength: rowCount, maxLength: rowCount }),
          fc.array(fc.integer({ min: 0, max: 10 }), { minLength: rowCount, maxLength: rowCount })
        )
        .map(([lengths, gaps]) => {
          const calendarRows: Array<{ periodStart: Date; periodEnd: Date }> = [];

          // Start the first row before or at startDate to guarantee at least 1 qualifying row
          let currentStart = new Date(startDate.getTime());
          currentStart.setDate(currentStart.getDate() - Math.floor(lengths[0] / 2));

          for (let i = 0; i < rowCount; i++) {
            const periodStart = new Date(currentStart.getTime());
            const periodEnd = new Date(periodStart.getTime());
            periodEnd.setDate(periodEnd.getDate() + lengths[i]);

            calendarRows.push({ periodStart, periodEnd });

            // Next row starts after this row ends + gap
            currentStart = new Date(periodEnd.getTime());
            currentStart.setDate(currentStart.getDate() + (gaps[i] || 1) + 1);
          }

          const academicYearEndDate = new Date(
            calendarRows[calendarRows.length - 1].periodEnd.getTime()
          );
          academicYearEndDate.setDate(academicYearEndDate.getDate() + 30);

          return {
            startDate,
            academicYearStartDate: startDate,
            academicYearEndDate,
            gracePeriodDays,
            billingDueDay,
            recurringFee,
            calendarRows,
          };
        });
    });
}

describe('Property 17: Custom Cycle Period Boundaries From Calendar', () => {
  describe('Custom billing cycle', () => {
    it('generates periods matching calendar rows whose period_end >= enrollment start_date', () => {
      fc.assert(
        fc.property(
          arbCustomInput(),
          ({ startDate, academicYearEndDate, gracePeriodDays, billingDueDay, recurringFee, calendarRows }) => {
            const input: GeneratePeriodsInput = {
              enrollmentId: 'test-enr-custom',
              startDate,
              academicYearStartDate: startDate,
              academicYearEndDate,
              billingCycle: 'custom',
              billingDueDay,
              gracePeriodDays,
              recurringFee,
              registrationFee: null,
              calendarRows,
            };

            const result = generatePeriodsForEnrollment(input);
            const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

            // Expected: filtered by periodEnd >= startDate, sorted by periodStart ascending
            const expectedRows = calendarRows
              .filter((row) => row.periodEnd >= startDate)
              .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

            expect(recurringPeriods.length).toBe(expectedRows.length);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('period_start and period_end copied unchanged from BranchCalendar rows; due_date derived from billing_due_day', () => {
      fc.assert(
        fc.property(
          arbCustomInput(),
          ({ startDate, academicYearEndDate, gracePeriodDays, billingDueDay, recurringFee, calendarRows }) => {
            const input: GeneratePeriodsInput = {
              enrollmentId: 'test-enr-custom',
              startDate,
              academicYearStartDate: startDate,
              academicYearEndDate,
              billingCycle: 'custom',
              billingDueDay,
              gracePeriodDays,
              recurringFee,
              registrationFee: null,
              calendarRows,
            };

            const result = generatePeriodsForEnrollment(input);
            const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

            // Filter and sort calendar rows the same way the service does
            const filteredRows = calendarRows
              .filter((row) => row.periodEnd >= startDate)
              .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

            for (let i = 0; i < recurringPeriods.length; i++) {
              expect(datesEqual(recurringPeriods[i].periodStart, filteredRows[i].periodStart)).toBe(true);
              expect(datesEqual(recurringPeriods[i].periodEnd, filteredRows[i].periodEnd)).toBe(true);
              expect(
                datesEqual(
                  recurringPeriods[i].dueDate,
                  expectedDueDate(filteredRows[i].periodStart, billingDueDay)
                )
              ).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
