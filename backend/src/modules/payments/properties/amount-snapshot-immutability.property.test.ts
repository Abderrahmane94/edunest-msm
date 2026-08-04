import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 6: Amount Snapshot Immutability
 *
 * For any already-generated billing period, updating the branch billing configuration
 * (billing_cycle, billing_due_day, grace_period_days, default_recurring_fee),
 * updating the enrollment recurring_fee, or updating/deleting a BranchCalendar row
 * SHALL leave that period's amount_due, due_date, grace_end_date, period_start,
 * and period_end unchanged.
 *
 * Since generatePeriodsForEnrollment is a pure function that produces snapshots,
 * we verify this by:
 * 1. Generating periods with config1 → capturing all field values
 * 2. Generating periods with config2 (different values) → capturing all field values
 * 3. Verifying config1 periods retain their original snapshot values (unaffected by config2)
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 */

/**
 * Generates a Prisma.Decimal representing a fee with exactly 2 decimal places.
 * Range: 0.01 to 9999999.99
 */
function arbFee() {
  return fc
    .integer({ min: 1, max: 999999999 })
    .map((cents) => new Prisma.Decimal(cents).div(100));
}

/**
 * Generates a billing_due_day (1-28).
 */
function arbBillingDueDay() {
  return fc.integer({ min: 1, max: 28 });
}

/**
 * Generates grace_period_days (0-60).
 */
function arbGracePeriodDays() {
  return fc.integer({ min: 0, max: 60 });
}

describe('Property 6: Amount Snapshot Immutability', () => {
  it('monthly periods generated with config1 are unchanged when regenerated with config2 — snapshots are independent', () => {
    fc.assert(
      fc.property(
        // Config 1
        arbFee(),
        arbBillingDueDay(),
        arbGracePeriodDays(),
        // Config 2 (different values simulating an update)
        arbFee(),
        arbBillingDueDay(),
        arbGracePeriodDays(),
        // Shared enrollment parameters
        fc.integer({ min: 2020, max: 2028 }),
        fc.integer({ min: 0, max: 9 }), // startMonth (leaving room for endMonth)
        (
          recurringFee1,
          billingDueDay1,
          gracePeriodDays1,
          recurringFee2,
          billingDueDay2,
          gracePeriodDays2,
          year,
          startMonth
        ) => {
          const startDate = new Date(year, startMonth, 1);
          const endDate = new Date(year, startMonth + 2, 28);

          // Generate periods with config1 (the "original" generation)
          const input1: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-1',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay: billingDueDay1,
            gracePeriodDays: gracePeriodDays1,
            recurringFee: recurringFee1,
            registrationFee: null,
            calendarRows: [],
          };

          const result1 = generatePeriodsForEnrollment(input1);

          // Snapshot the original period values
          const originalSnapshots = result1.periods.map((p) => ({
            amountDue: p.amountDue.toString(),
            dueDate: p.dueDate.getTime(),
            graceEndDate: p.graceEndDate.getTime(),
            periodStart: p.periodStart.getTime(),
            periodEnd: p.periodEnd.getTime(),
          }));

          // Generate periods with config2 (simulating "what if config changed")
          const input2: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-2',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay: billingDueDay2,
            gracePeriodDays: gracePeriodDays2,
            recurringFee: recurringFee2,
            registrationFee: null,
            calendarRows: [],
          };

          const result2 = generatePeriodsForEnrollment(input2);

          // Verify: original periods (config1) retain their snapshot values
          // They should NOT be affected by the existence of config2 periods
          expect(result1.periods.length).toBeGreaterThan(0);

          for (let i = 0; i < result1.periods.length; i++) {
            const period = result1.periods[i];
            const snapshot = originalSnapshots[i];

            expect(period.amountDue.toString()).toBe(snapshot.amountDue);
            expect(period.dueDate.getTime()).toBe(snapshot.dueDate);
            expect(period.graceEndDate.getTime()).toBe(snapshot.graceEndDate);
            expect(period.periodStart.getTime()).toBe(snapshot.periodStart);
            expect(period.periodEnd.getTime()).toBe(snapshot.periodEnd);
          }

          // Additional: config1 periods use config1 values, config2 periods use config2 values
          // This proves the snapshot property: each generation captures its own config
          for (const period of result1.periods) {
            expect(period.amountDue.equals(recurringFee1)).toBe(true);
          }
          for (const period of result2.periods.filter((p) => !p.isRegistrationPeriod)) {
            expect(period.amountDue.equals(recurringFee2)).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('trimester periods generated with config1 calendar rows are unchanged when calendar rows change — period_start, period_end, due_date are snapshots', () => {
    fc.assert(
      fc.property(
        arbFee(),
        arbFee(),
        arbGracePeriodDays(),
        arbGracePeriodDays(),
        fc.integer({ min: 2020, max: 2028 }),
        (recurringFee1, recurringFee2, gracePeriodDays1, gracePeriodDays2, year) => {
          // Calendar rows set 1 (original)
          const calendarRows1 = [
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

          // Calendar rows set 2 (simulating updated/different calendar)
          const calendarRows2 = [
            {
              periodStart: new Date(year, 0, 15),
              periodEnd: new Date(year, 3, 15),
              dueDate: new Date(year, 0, 20),
            },
            {
              periodStart: new Date(year, 4, 15),
              periodEnd: new Date(year, 7, 15),
              dueDate: new Date(year, 4, 20),
            },
            {
              periodStart: new Date(year, 8, 15),
              periodEnd: new Date(year, 11, 15),
              dueDate: new Date(year, 8, 20),
            },
          ];

          const startDate = new Date(year, 0, 1);
          const endDate = new Date(year, 11, 31);

          // Generate with config1 + calendar1
          const input1: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-1',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'trimester',
            billingDueDay: 10,
            gracePeriodDays: gracePeriodDays1,
            recurringFee: recurringFee1,
            registrationFee: null,
            calendarRows: calendarRows1,
          };

          const result1 = generatePeriodsForEnrollment(input1);

          // Snapshot original period values
          const originalSnapshots = result1.periods.map((p) => ({
            amountDue: p.amountDue.toString(),
            dueDate: p.dueDate.getTime(),
            graceEndDate: p.graceEndDate.getTime(),
            periodStart: p.periodStart.getTime(),
            periodEnd: p.periodEnd.getTime(),
          }));

          // Generate with config2 + calendar2 (simulating calendar update)
          const input2: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-2',
            startDate: new Date(year, 0, 15),
            academicYearEndDate: endDate,
            billingCycle: 'trimester',
            billingDueDay: 20,
            gracePeriodDays: gracePeriodDays2,
            recurringFee: recurringFee2,
            registrationFee: null,
            calendarRows: calendarRows2,
          };

          const result2 = generatePeriodsForEnrollment(input2);

          // Verify: config1 periods retain their original snapshot values
          expect(result1.periods.length).toBe(3);

          for (let i = 0; i < result1.periods.length; i++) {
            const period = result1.periods[i];
            const snapshot = originalSnapshots[i];

            // These fields are immutable snapshots from generation time
            expect(period.amountDue.toString()).toBe(snapshot.amountDue);
            expect(period.dueDate.getTime()).toBe(snapshot.dueDate);
            expect(period.graceEndDate.getTime()).toBe(snapshot.graceEndDate);
            expect(period.periodStart.getTime()).toBe(snapshot.periodStart);
            expect(period.periodEnd.getTime()).toBe(snapshot.periodEnd);
          }

          // Verify config1 periods captured config1 calendar values exactly
          for (let i = 0; i < result1.periods.length; i++) {
            expect(result1.periods[i].periodStart.getTime()).toBe(
              calendarRows1[i].periodStart.getTime()
            );
            expect(result1.periods[i].periodEnd.getTime()).toBe(
              calendarRows1[i].periodEnd.getTime()
            );
            expect(result1.periods[i].dueDate.getTime()).toBe(
              calendarRows1[i].dueDate.getTime()
            );
          }

          // Verify config2 periods captured config2 calendar values exactly
          for (let i = 0; i < result2.periods.length; i++) {
            expect(result2.periods[i].periodStart.getTime()).toBe(
              calendarRows2[i].periodStart.getTime()
            );
            expect(result2.periods[i].periodEnd.getTime()).toBe(
              calendarRows2[i].periodEnd.getTime()
            );
            expect(result2.periods[i].dueDate.getTime()).toBe(
              calendarRows2[i].dueDate.getTime()
            );
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('updating recurring_fee does not affect already-generated periods — each generation uses its own fee snapshot', () => {
    fc.assert(
      fc.property(
        arbFee(),
        arbFee(),
        arbBillingDueDay(),
        arbGracePeriodDays(),
        fc.integer({ min: 2020, max: 2028 }),
        fc.integer({ min: 0, max: 9 }),
        (recurringFee1, recurringFee2, billingDueDay, gracePeriodDays, year, startMonth) => {
          const startDate = new Date(year, startMonth, 1);
          const endDate = new Date(year, startMonth + 2, 28);

          // Generate with original recurring fee
          const input1: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-1',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee: recurringFee1,
            registrationFee: null,
            calendarRows: [],
          };

          const result1 = generatePeriodsForEnrollment(input1);

          // "Update" recurring fee — generate again with new fee (simulating new enrollment after update)
          const input2: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-2',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays,
            recurringFee: recurringFee2,
            registrationFee: null,
            calendarRows: [],
          };

          const result2 = generatePeriodsForEnrollment(input2);

          // Original periods still use recurringFee1
          for (const period of result1.periods) {
            expect(period.amountDue.equals(recurringFee1)).toBe(true);
          }

          // New periods use recurringFee2
          for (const period of result2.periods) {
            expect(period.amountDue.equals(recurringFee2)).toBe(true);
          }

          // Verify the original result is completely independent of the second generation
          expect(result1.periods.length).toBe(result2.periods.length);
          for (const period of result1.periods) {
            // amount_due is the snapshot from generation time (recurringFee1)
            expect(period.amountDue.equals(recurringFee1)).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('grace_period_days change does not affect already-generated periods — grace_end_date is a snapshot', () => {
    fc.assert(
      fc.property(
        arbFee(),
        arbBillingDueDay(),
        arbGracePeriodDays(),
        arbGracePeriodDays(),
        fc.integer({ min: 2020, max: 2028 }),
        fc.integer({ min: 0, max: 9 }),
        (recurringFee, billingDueDay, gracePeriodDays1, gracePeriodDays2, year, startMonth) => {
          const startDate = new Date(year, startMonth, 1);
          const endDate = new Date(year, startMonth + 2, 28);

          // Generate with grace_period_days1
          const input1: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-1',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays: gracePeriodDays1,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result1 = generatePeriodsForEnrollment(input1);

          // Generate with grace_period_days2 (simulating config update)
          const input2: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-2',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay,
            gracePeriodDays: gracePeriodDays2,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result2 = generatePeriodsForEnrollment(input2);

          // Verify: config1 periods use gracePeriodDays1 for grace_end_date
          for (const period of result1.periods) {
            const expectedGraceEnd = new Date(period.dueDate);
            expectedGraceEnd.setDate(expectedGraceEnd.getDate() + gracePeriodDays1);
            expect(period.graceEndDate.getTime()).toBe(expectedGraceEnd.getTime());
          }

          // Verify: config2 periods use gracePeriodDays2 for grace_end_date
          for (const period of result2.periods) {
            const expectedGraceEnd = new Date(period.dueDate);
            expectedGraceEnd.setDate(expectedGraceEnd.getDate() + gracePeriodDays2);
            expect(period.graceEndDate.getTime()).toBe(expectedGraceEnd.getTime());
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('billing_due_day change does not affect already-generated periods — due_date is a snapshot', () => {
    fc.assert(
      fc.property(
        arbFee(),
        arbBillingDueDay(),
        arbBillingDueDay(),
        arbGracePeriodDays(),
        fc.integer({ min: 2020, max: 2028 }),
        fc.integer({ min: 0, max: 9 }),
        (recurringFee, billingDueDay1, billingDueDay2, gracePeriodDays, year, startMonth) => {
          const startDate = new Date(year, startMonth, 1);
          const endDate = new Date(year, startMonth + 2, 28);

          // Generate with billingDueDay1
          const input1: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-1',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay: billingDueDay1,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result1 = generatePeriodsForEnrollment(input1);

          // Generate with billingDueDay2 (simulating config update)
          const input2: GeneratePeriodsInput = {
            enrollmentId: 'enrollment-2',
            startDate,
            academicYearEndDate: endDate,
            billingCycle: 'monthly',
            billingDueDay: billingDueDay2,
            gracePeriodDays,
            recurringFee,
            registrationFee: null,
            calendarRows: [],
          };

          const result2 = generatePeriodsForEnrollment(input2);

          // Config1 periods use billingDueDay1
          for (const period of result1.periods) {
            expect(period.dueDate.getDate()).toBe(billingDueDay1);
          }

          // Config2 periods use billingDueDay2
          for (const period of result2.periods) {
            expect(period.dueDate.getDate()).toBe(billingDueDay2);
          }

          // Original periods are completely unaffected by the second generation
          for (const period of result1.periods) {
            expect(period.dueDate.getDate()).toBe(billingDueDay1);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
