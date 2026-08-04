import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 17: Trimester/Custom Period Boundaries From Calendar
 *
 * For any enrollment at a branch with `trimester` or `custom` billing cycle,
 * the generated billing periods' `period_start`, `period_end`, and `due_date` values
 * SHALL match exactly the corresponding BranchCalendar rows (for rows whose
 * `period_end` >= enrollment `start_date`), taken in ascending `period_start` order
 * with no date transformation.
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
 * Generates a calendar row with period_start <= period_end and due_date >= period_start.
 */
function arbCalendarRow() {
  return arbDateOnly().chain((periodStart) => {
    // period_end is same day or up to 120 days after period_start
    return fc
      .tuple(
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 30 })
      )
      .map(([endOffset, dueOffset]) => {
        const periodEnd = new Date(periodStart.getTime());
        periodEnd.setDate(periodEnd.getDate() + endOffset);
        const dueDate = new Date(periodStart.getTime());
        dueDate.setDate(dueDate.getDate() + dueOffset);
        return { periodStart, periodEnd, dueDate };
      });
  });
}

/**
 * Generates exactly 3 calendar rows for trimester cycle where all rows have
 * period_end >= the enrollment start_date. Rows are generated in non-overlapping
 * ascending order.
 */
function arbTrimesterInput() {
  return fc
    .tuple(
      arbDateOnly(2020, 2025),
      fc.integer({ min: 0, max: 60 }),
      fc.integer({ min: 1, max: 28 }),
      fc.integer({ min: 1, max: 999999999 }).map((v) => new Prisma.Decimal(v).div(100))
    )
    .chain(([startDate, gracePeriodDays, billingDueDay, recurringFee]) => {
      // Generate 3 non-overlapping calendar rows all with periodEnd >= startDate
      return fc
        .tuple(
          fc.integer({ min: 30, max: 120 }),
          fc.integer({ min: 30, max: 120 }),
          fc.integer({ min: 30, max: 120 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 })
        )
        .map(([len1, len2, len3, gap1, gap2, dueOff]) => {
          // First row starts at or before startDate
          const row1Start = new Date(startDate.getTime());
          row1Start.setDate(row1Start.getDate() - Math.floor(len1 / 2));
          const row1End = new Date(row1Start.getTime());
          row1End.setDate(row1End.getDate() + len1);
          const row1Due = new Date(row1Start.getTime());
          row1Due.setDate(row1Due.getDate() + dueOff);

          const row2Start = new Date(row1End.getTime());
          row2Start.setDate(row2Start.getDate() + gap1 + 1);
          const row2End = new Date(row2Start.getTime());
          row2End.setDate(row2End.getDate() + len2);
          const row2Due = new Date(row2Start.getTime());
          row2Due.setDate(row2Due.getDate() + dueOff);

          const row3Start = new Date(row2End.getTime());
          row3Start.setDate(row3Start.getDate() + gap2 + 1);
          const row3End = new Date(row3Start.getTime());
          row3End.setDate(row3End.getDate() + len3);
          const row3Due = new Date(row3Start.getTime());
          row3Due.setDate(row3Due.getDate() + dueOff);

          const calendarRows = [
            { periodStart: row1Start, periodEnd: row1End, dueDate: row1Due },
            { periodStart: row2Start, periodEnd: row2End, dueDate: row2Due },
            { periodStart: row3Start, periodEnd: row3End, dueDate: row3Due },
          ];

          // Ensure all rows have periodEnd >= startDate (by construction row1End >= startDate)
          // We already ensured row1Start <= startDate and row1End = row1Start + len1 >= startDate
          const academicYearEndDate = new Date(row3End.getTime());
          academicYearEndDate.setDate(academicYearEndDate.getDate() + 30);

          return {
            startDate,
            academicYearEndDate,
            gracePeriodDays,
            billingDueDay,
            recurringFee,
            calendarRows,
          };
        });
    });
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
          fc.array(fc.integer({ min: 0, max: 10 }), { minLength: rowCount, maxLength: rowCount }),
          fc.integer({ min: 0, max: 10 })
        )
        .map(([lengths, gaps, dueOff]) => {
          const calendarRows: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }> = [];

          // Start the first row before or at startDate to guarantee at least 1 qualifying row
          let currentStart = new Date(startDate.getTime());
          currentStart.setDate(currentStart.getDate() - Math.floor(lengths[0] / 2));

          for (let i = 0; i < rowCount; i++) {
            const periodStart = new Date(currentStart.getTime());
            const periodEnd = new Date(periodStart.getTime());
            periodEnd.setDate(periodEnd.getDate() + lengths[i]);
            const dueDate = new Date(periodStart.getTime());
            dueDate.setDate(dueDate.getDate() + dueOff);

            calendarRows.push({ periodStart, periodEnd, dueDate });

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
            academicYearEndDate,
            gracePeriodDays,
            billingDueDay,
            recurringFee,
            calendarRows,
          };
        });
    });
}

describe('Property 17: Trimester/Custom Period Boundaries From Calendar', () => {
  describe('Trimester billing cycle', () => {
    it('generates exactly 3 periods matching 3 calendar rows', () => {
      fc.assert(
        fc.property(
          arbTrimesterInput(),
          ({ startDate, academicYearEndDate, gracePeriodDays, billingDueDay, recurringFee, calendarRows }) => {
            const input: GeneratePeriodsInput = {
              enrollmentId: 'test-enr-trimester',
              startDate,
              academicYearEndDate,
              billingCycle: 'trimester',
              billingDueDay,
              gracePeriodDays,
              recurringFee,
              registrationFee: null,
              calendarRows,
            };

            const result = generatePeriodsForEnrollment(input);
            const recurringPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

            // Trimester must generate exactly 3 recurring periods
            expect(recurringPeriods.length).toBe(3);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('period_start, period_end, and due_date copied unchanged from BranchCalendar rows in ascending period_start order', () => {
      fc.assert(
        fc.property(
          arbTrimesterInput(),
          ({ startDate, academicYearEndDate, gracePeriodDays, billingDueDay, recurringFee, calendarRows }) => {
            const input: GeneratePeriodsInput = {
              enrollmentId: 'test-enr-trimester',
              startDate,
              academicYearEndDate,
              billingCycle: 'trimester',
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

            expect(recurringPeriods.length).toBe(filteredRows.length);

            for (let i = 0; i < recurringPeriods.length; i++) {
              expect(datesEqual(recurringPeriods[i].periodStart, filteredRows[i].periodStart)).toBe(true);
              expect(datesEqual(recurringPeriods[i].periodEnd, filteredRows[i].periodEnd)).toBe(true);
              expect(datesEqual(recurringPeriods[i].dueDate, filteredRows[i].dueDate)).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Custom billing cycle', () => {
    it('generates periods matching calendar rows whose period_end >= enrollment start_date', () => {
      fc.assert(
        fc.property(
          arbCustomInput(),
          ({ startDate, academicYearEndDate, gracePeriodDays, billingDueDay, recurringFee, calendarRows }) => {
            const input: GeneratePeriodsInput = {
              enrollmentId: 'test-enr-custom',
              startDate,
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

    it('period_start, period_end, and due_date copied unchanged from BranchCalendar rows', () => {
      fc.assert(
        fc.property(
          arbCustomInput(),
          ({ startDate, academicYearEndDate, gracePeriodDays, billingDueDay, recurringFee, calendarRows }) => {
            const input: GeneratePeriodsInput = {
              enrollmentId: 'test-enr-custom',
              startDate,
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
              expect(datesEqual(recurringPeriods[i].dueDate, filteredRows[i].dueDate)).toBe(true);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
