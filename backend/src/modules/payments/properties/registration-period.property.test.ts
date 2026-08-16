import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generatePeriodsForEnrollment } from '../billing-period.service';
import type { GeneratePeriodsInput } from '../billing-period.service';

/**
 * Property 5: Registration Period Generation
 *
 * For any enrollment with a non-null registration_fee, exactly one billing period SHALL be
 * generated with is_registration_period = true, its amount_due SHALL equal the registration_fee,
 * its period_start and period_end SHALL both equal the enrollment start_date, its due_date SHALL
 * equal the enrollment start_date, and its grace_end_date SHALL equal start_date + grace_period_days.
 * For any enrollment with a null registration_fee, no billing period with is_registration_period = true
 * SHALL exist.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.7**
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

function arbDateOnly(minYear = 2020, maxYear = 2029) {
  return fc
    .tuple(
      fc.integer({ min: minYear, max: maxYear }),
      fc.integer({ min: 0, max: 11 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(([year, month, day]) => new Date(year, month, day));
}

const registrationFeeArb = fc.option(
  fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
    (v) => new Prisma.Decimal(v.toFixed(2))
  )
);

const recurringFeeArb = fc
  .integer({ min: 1, max: 999999999 })
  .map((v) => new Prisma.Decimal(v).div(100));

describe('Property 5: Registration Period Generation', () => {
  it('when registrationFee is non-null, exactly 1 period with isRegistrationPeriod=true exists', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
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
          const regPeriods = result.periods.filter((p) => p.isRegistrationPeriod);

          expect(regPeriods).toHaveLength(1);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('registration period amountDue equals registrationFee', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
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
          const regPeriod = result.periods.find((p) => p.isRegistrationPeriod)!;

          expect(regPeriod.amountDue.equals(registrationFee)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('registration period periodStart and periodEnd both equal startDate', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
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
          const regPeriod = result.periods.find((p) => p.isRegistrationPeriod)!;

          expect(datesEqual(regPeriod.periodStart, startDate)).toBe(true);
          expect(datesEqual(regPeriod.periodEnd, startDate)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('registration period dueDate equals startDate', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
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
          const regPeriod = result.periods.find((p) => p.isRegistrationPeriod)!;

          expect(datesEqual(regPeriod.dueDate, startDate)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('registration period graceEndDate equals startDate + gracePeriodDays', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        fc.double({ min: 0, max: 9999999.99, noNaN: true }).map(
          (v) => new Prisma.Decimal(v.toFixed(2))
        ),
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
          const regPeriod = result.periods.find((p) => p.isRegistrationPeriod)!;

          const expectedGraceEnd = addDays(startDate, gracePeriodDays);
          expect(datesEqual(regPeriod.graceEndDate, expectedGraceEnd)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('when registrationFee is null, no period with isRegistrationPeriod=true exists', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        (startDate, billingDueDay, gracePeriodDays, recurringFee) => {
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
          const regPeriods = result.periods.filter((p) => p.isRegistrationPeriod);

          expect(regPeriods).toHaveLength(0);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('all non-registration periods have isRegistrationPeriod=false', () => {
    fc.assert(
      fc.property(
        arbDateOnly(),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        recurringFeeArb,
        registrationFeeArb,
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

          // Count how many registration periods exist
          const regPeriods = result.periods.filter((p) => p.isRegistrationPeriod);
          const nonRegPeriods = result.periods.filter((p) => !p.isRegistrationPeriod);

          // At most 1 registration period (0 if null, 1 if non-null)
          if (registrationFee !== null) {
            expect(regPeriods).toHaveLength(1);
          } else {
            expect(regPeriods).toHaveLength(0);
          }

          // All non-registration periods must have isRegistrationPeriod = false
          for (const period of nonRegPeriods) {
            expect(period.isRegistrationPeriod).toBe(false);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
