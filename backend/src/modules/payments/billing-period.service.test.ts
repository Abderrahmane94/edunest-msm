import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { derivePeriodStatus, generatePeriodsForEnrollment } from './billing-period.service';
import type { GeneratePeriodsInput } from './billing-period.service';

const dec = (v: string | number) => new Prisma.Decimal(v);

describe('derivePeriodStatus', () => {
  const pastGrace = new Date('2024-01-10');
  const currentAfterGrace = new Date('2024-01-15');
  const currentBeforeGrace = new Date('2024-01-05');

  describe('paid status', () => {
    it('returns paid when totalPaid equals amountDue', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('1000.00'),
        pastGrace,
        currentAfterGrace,
        null
      );
      expect(result.status).toBe('paid');
      expect(result.isLate).toBe(false);
      expect(result.outstanding.toString()).toBe('0');
    });

    it('returns paid when totalPaid exceeds amountDue (overpayment)', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('1500.00'),
        pastGrace,
        currentAfterGrace,
        null
      );
      expect(result.status).toBe('paid');
      expect(result.isLate).toBe(false);
      expect(result.outstanding.toString()).toBe('-500');
    });

    it('returns paid regardless of grace period when fully paid', () => {
      const result = derivePeriodStatus(
        dec('500.00'),
        dec('500.00'),
        pastGrace,
        currentBeforeGrace,
        null
      );
      expect(result.status).toBe('paid');
      expect(result.isLate).toBe(false);
    });
  });

  describe('partial status (before grace end)', () => {
    it('returns partial when partially paid and before grace end', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('300.00'),
        pastGrace,
        currentBeforeGrace,
        null
      );
      expect(result.status).toBe('partial');
      expect(result.isLate).toBe(false);
      expect(result.outstanding.toString()).toBe('700');
    });

    it('returns partial with minimal payment before grace end', () => {
      const result = derivePeriodStatus(
        dec('5000.00'),
        dec('0.01'),
        pastGrace,
        currentBeforeGrace,
        null
      );
      expect(result.status).toBe('partial');
      expect(result.isLate).toBe(false);
    });
  });

  describe('late_partial status (after grace end)', () => {
    it('returns late_partial when partially paid and after grace end', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('300.00'),
        pastGrace,
        currentAfterGrace,
        null
      );
      expect(result.status).toBe('late_partial');
      expect(result.isLate).toBe(true);
      expect(result.outstanding.toString()).toBe('700');
    });
  });

  describe('unpaid status (before grace end)', () => {
    it('returns unpaid when nothing paid and before grace end', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('0.00'),
        pastGrace,
        currentBeforeGrace,
        null
      );
      expect(result.status).toBe('unpaid');
      expect(result.isLate).toBe(false);
      expect(result.outstanding.toString()).toBe('1000');
    });

    it('returns unpaid when totalPaid is negative (correction) and before grace end', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('-200.00'),
        pastGrace,
        currentBeforeGrace,
        null
      );
      expect(result.status).toBe('unpaid');
      expect(result.isLate).toBe(false);
      expect(result.outstanding.toString()).toBe('1200');
    });
  });

  describe('late status (after grace end)', () => {
    it('returns late when nothing paid and after grace end', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('0.00'),
        pastGrace,
        currentAfterGrace,
        null
      );
      expect(result.status).toBe('late');
      expect(result.isLate).toBe(true);
      expect(result.outstanding.toString()).toBe('1000');
    });

    it('returns late when totalPaid is negative and after grace end', () => {
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('-100.00'),
        pastGrace,
        currentAfterGrace,
        null
      );
      expect(result.status).toBe('late');
      expect(result.isLate).toBe(true);
    });
  });

  describe('cancelled periods', () => {
    it('returns isLate=false when period is cancelled even if status would be late', () => {
      const cancelledAt = new Date('2024-01-12');
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('0.00'),
        pastGrace,
        currentAfterGrace,
        cancelledAt
      );
      expect(result.status).toBe('late');
      expect(result.isLate).toBe(false);
    });

    it('returns isLate=false when cancelled even if status would be late_partial', () => {
      const cancelledAt = new Date('2024-01-11');
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('300.00'),
        pastGrace,
        currentAfterGrace,
        cancelledAt
      );
      expect(result.status).toBe('late_partial');
      expect(result.isLate).toBe(false);
    });

    it('returns isLate=false for paid cancelled periods', () => {
      const cancelledAt = new Date('2024-01-08');
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('1000.00'),
        pastGrace,
        currentAfterGrace,
        cancelledAt
      );
      expect(result.status).toBe('paid');
      expect(result.isLate).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles zero amount_due with zero paid as paid', () => {
      const result = derivePeriodStatus(
        dec('0.00'),
        dec('0.00'),
        pastGrace,
        currentAfterGrace,
        null
      );
      // 0.00 >= 0.00 is true, so status is 'paid'
      expect(result.status).toBe('paid');
      expect(result.isLate).toBe(false);
    });

    it('handles currentDate equal to graceEndDate as not late', () => {
      const graceEnd = new Date('2024-01-10');
      const sameDay = new Date('2024-01-10');
      const result = derivePeriodStatus(
        dec('1000.00'),
        dec('0.00'),
        graceEnd,
        sameDay,
        null
      );
      // currentDate > graceEndDate is false when equal
      expect(result.status).toBe('unpaid');
      expect(result.isLate).toBe(false);
    });

    it('returns correct outstanding amount', () => {
      const result = derivePeriodStatus(
        dec('2500.50'),
        dec('1000.25'),
        pastGrace,
        currentBeforeGrace,
        null
      );
      expect(result.outstanding.toString()).toBe('1500.25');
      expect(result.totalPaid.toString()).toBe('1000.25');
    });
  });
});

describe('generatePeriodsForEnrollment', () => {
  const dec = (v: string | number) => new Prisma.Decimal(v);

  describe('monthly billing cycle', () => {
    it('generates correct number of periods from Sep to Jun (10 months)', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 8, 15), // Sep 15, 2024
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearEndDate: new Date(2025, 5, 30), // Jun 30, 2025
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('5000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periodsCreated).toBe(10); // Sep through Jun
      expect(result.periods.every((p) => !p.isRegistrationPeriod)).toBe(true);
    });

    it('sets period_start to first of month and period_end to last of month', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 0, 15), // Jan 15
        academicYearStartDate: new Date(2024, 0, 15),
        academicYearEndDate: new Date(2024, 2, 31), // Mar 31
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 0,
        recurringFee: dec('3000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periodsCreated).toBe(3); // Jan, Feb, Mar

      // January
      expect(result.periods[0].periodStart).toEqual(new Date(2024, 0, 1));
      expect(result.periods[0].periodEnd).toEqual(new Date(2024, 0, 31));

      // February (leap year 2024)
      expect(result.periods[1].periodStart).toEqual(new Date(2024, 1, 1));
      expect(result.periods[1].periodEnd).toEqual(new Date(2024, 1, 29));

      // March
      expect(result.periods[2].periodStart).toEqual(new Date(2024, 2, 1));
      expect(result.periods[2].periodEnd).toEqual(new Date(2024, 2, 31));
    });

    it('sets due_date day to billingDueDay for each month', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 3, 20), // Apr 20
        academicYearStartDate: new Date(2024, 3, 20),
        academicYearEndDate: new Date(2024, 5, 30), // Jun 30
        billingCycle: 'monthly',
        billingDueDay: 15,
        gracePeriodDays: 5,
        recurringFee: dec('2000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periods[0].dueDate).toEqual(new Date(2024, 3, 15)); // Apr 15
      expect(result.periods[1].dueDate).toEqual(new Date(2024, 4, 15)); // May 15
      expect(result.periods[2].dueDate).toEqual(new Date(2024, 5, 15)); // Jun 15
    });

    it('calculates grace_end_date = due_date + grace_period_days', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 0, 1),
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearEndDate: new Date(2024, 0, 31),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 7,
        recurringFee: dec('1000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periods[0].graceEndDate).toEqual(new Date(2024, 0, 17)); // Jan 10 + 7 = Jan 17
    });

    it('sets grace_end_date equal to due_date when grace_period_days is 0', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 0, 1),
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearEndDate: new Date(2024, 0, 31),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 0,
        recurringFee: dec('1000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periods[0].graceEndDate).toEqual(result.periods[0].dueDate);
    });

    it('sets amount_due to recurring_fee for all periods', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 0, 1),
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearEndDate: new Date(2024, 2, 31),
        billingCycle: 'monthly',
        billingDueDay: 5,
        gracePeriodDays: 5,
        recurringFee: dec('4500.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      result.periods.forEach((p) => {
        expect(p.amountDue.toString()).toBe('4500');
      });
    });

    it('generates single period when start and end are same month', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-1',
        startDate: new Date(2024, 5, 10),
        academicYearStartDate: new Date(2024, 5, 10),
        academicYearStartDate: new Date(2024, 5, 10),
        academicYearEndDate: new Date(2024, 5, 30),
        billingCycle: 'monthly',
        billingDueDay: 15,
        gracePeriodDays: 5,
        recurringFee: dec('1000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periodsCreated).toBe(1);
    });
  });

  describe('trimester billing cycle', () => {
    const calendarRows = [
      { periodStart: new Date(2024, 8, 1), periodEnd: new Date(2024, 11, 31), dueDate: new Date(2024, 8, 10) },
      { periodStart: new Date(2025, 0, 1), periodEnd: new Date(2025, 3, 30), dueDate: new Date(2025, 0, 10) },
      { periodStart: new Date(2025, 4, 1), periodEnd: new Date(2025, 5, 30), dueDate: new Date(2025, 4, 10) },
    ];

    it('generates 3 periods from calendar rows', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-2',
        startDate: new Date(2024, 8, 1), // Sep 1
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'trimester',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('15000.00'),
        registrationFee: null,
        calendarRows,
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periodsCreated).toBe(3);
      expect(result.periods[0].periodStart).toEqual(new Date(2024, 8, 1));
      expect(result.periods[0].periodEnd).toEqual(new Date(2024, 11, 31));
      expect(result.periods[0].dueDate).toEqual(new Date(2024, 8, 10));
    });

    it('filters rows by periodEnd >= startDate', () => {
      // Start date after first period ends
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-2',
        startDate: new Date(2025, 0, 5), // Jan 5, 2025 — first row's periodEnd (Dec 31) is before this
        academicYearStartDate: new Date(2025, 0, 5),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'trimester',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('15000.00'),
        registrationFee: null,
        calendarRows,
      };

      // After filtering, only 2 rows remain — trimester requires exactly 3
      expect(() => generatePeriodsForEnrollment(input)).toThrow(/exactly 3/);
    });

    it('throws error when fewer than 3 rows after filtering', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-2',
        startDate: new Date(2025, 4, 1),
        academicYearStartDate: new Date(2025, 4, 1),
        academicYearStartDate: new Date(2025, 4, 1),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'trimester',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('15000.00'),
        registrationFee: null,
        calendarRows,
      };

      expect(() => generatePeriodsForEnrollment(input)).toThrow(/exactly 3/);
    });

    it('throws error when more than 3 rows', () => {
      const fourRows = [
        ...calendarRows,
        { periodStart: new Date(2025, 6, 1), periodEnd: new Date(2025, 7, 31), dueDate: new Date(2025, 6, 10) },
      ];

      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-2',
        startDate: new Date(2024, 8, 1),
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearEndDate: new Date(2025, 7, 31),
        billingCycle: 'trimester',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('15000.00'),
        registrationFee: null,
        calendarRows: fourRows,
      };

      expect(() => generatePeriodsForEnrollment(input)).toThrow(/exactly 3/);
    });
  });

  describe('custom billing cycle', () => {
    it('generates periods from calendar rows', () => {
      const rows = [
        { periodStart: new Date(2024, 8, 1), periodEnd: new Date(2024, 9, 31), dueDate: new Date(2024, 8, 15) },
        { periodStart: new Date(2024, 10, 1), periodEnd: new Date(2025, 0, 31), dueDate: new Date(2024, 10, 15) },
      ];

      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-3',
        startDate: new Date(2024, 8, 1),
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'custom',
        billingDueDay: 10,
        gracePeriodDays: 3,
        recurringFee: dec('8000.00'),
        registrationFee: null,
        calendarRows: rows,
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periodsCreated).toBe(2);
      expect(result.periods[0].periodStart).toEqual(new Date(2024, 8, 1));
      expect(result.periods[1].periodEnd).toEqual(new Date(2025, 0, 31));
    });

    it('throws error when no calendar rows remain after filtering', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-3',
        startDate: new Date(2025, 6, 1), // After all rows end
        academicYearStartDate: new Date(2025, 6, 1),
        academicYearEndDate: new Date(2025, 8, 30),
        billingCycle: 'custom',
        billingDueDay: 10,
        gracePeriodDays: 3,
        recurringFee: dec('8000.00'),
        registrationFee: null,
        calendarRows: [
          { periodStart: new Date(2024, 8, 1), periodEnd: new Date(2025, 5, 30), dueDate: new Date(2024, 8, 15) },
        ],
      };

      expect(() => generatePeriodsForEnrollment(input)).toThrow(/at least 1/);
    });

    it('accepts 1 or more rows for custom cycle', () => {
      const rows = [
        { periodStart: new Date(2024, 8, 1), periodEnd: new Date(2025, 5, 30), dueDate: new Date(2024, 8, 15) },
      ];

      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-3',
        startDate: new Date(2024, 8, 1),
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearStartDate: new Date(2024, 8, 1),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'custom',
        billingDueDay: 10,
        gracePeriodDays: 3,
        recurringFee: dec('20000.00'),
        registrationFee: null,
        calendarRows: rows,
      };

      const result = generatePeriodsForEnrollment(input);
      expect(result.periodsCreated).toBe(1);
    });
  });

  describe('registration period', () => {
    it('generates a registration period when registrationFee is non-null', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-4',
        startDate: new Date(2024, 8, 15),
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('5000.00'),
        registrationFee: dec('2000.00'),
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);
      const regPeriod = result.periods.find((p) => p.isRegistrationPeriod);

      expect(regPeriod).toBeDefined();
      expect(regPeriod!.periodStart).toEqual(new Date(2024, 8, 15));
      expect(regPeriod!.periodEnd).toEqual(new Date(2024, 8, 15));
      expect(regPeriod!.dueDate).toEqual(new Date(2024, 8, 15));
      expect(regPeriod!.amountDue.toString()).toBe('2000');
      expect(regPeriod!.graceEndDate).toEqual(new Date(2024, 8, 20)); // Sep 15 + 5
    });

    it('does not generate registration period when registrationFee is null', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-4',
        startDate: new Date(2024, 8, 15),
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('5000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);
      const regPeriod = result.periods.find((p) => p.isRegistrationPeriod);

      expect(regPeriod).toBeUndefined();
    });

    it('generates registration period with 0.00 fee', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-4',
        startDate: new Date(2024, 8, 15),
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearStartDate: new Date(2024, 8, 15),
        academicYearEndDate: new Date(2024, 8, 30),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('5000.00'),
        registrationFee: dec('0.00'),
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);
      const regPeriod = result.periods.find((p) => p.isRegistrationPeriod);

      expect(regPeriod).toBeDefined();
      expect(regPeriod!.amountDue.toString()).toBe('0');
    });
  });

  describe('first period amount override', () => {
    it('applies first period override when startDate > first period start', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-5',
        startDate: new Date(2024, 0, 15), // Jan 15 > Jan 1 (period start)
        academicYearStartDate: new Date(2024, 0, 15),
        academicYearEndDate: new Date(2024, 2, 31),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('6000.00'),
        registrationFee: null,
        firstPeriodAmountDue: dec('3000.00'),
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      // First recurring period gets the override
      expect(result.periods[0].amountDue.toString()).toBe('3000');
      // Second period uses full recurring fee
      expect(result.periods[1].amountDue.toString()).toBe('6000');
      // Third period uses full recurring fee
      expect(result.periods[2].amountDue.toString()).toBe('6000');
    });

    it('does NOT apply override when startDate equals first period start', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-5',
        startDate: new Date(2024, 0, 1), // Jan 1 = Jan 1 (period start)
        academicYearStartDate: new Date(2024, 0, 1),
        academicYearEndDate: new Date(2024, 2, 31),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('6000.00'),
        registrationFee: null,
        firstPeriodAmountDue: dec('3000.00'),
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      // Override not applied because startDate is NOT > periodStart
      expect(result.periods[0].amountDue.toString()).toBe('6000');
    });

    it('does NOT apply override when firstPeriodAmountDue is not provided', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-5',
        startDate: new Date(2024, 0, 15),
        academicYearStartDate: new Date(2024, 0, 15),
        academicYearStartDate: new Date(2024, 0, 15),
        academicYearEndDate: new Date(2024, 2, 31),
        billingCycle: 'monthly',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('6000.00'),
        registrationFee: null,
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      expect(result.periods[0].amountDue.toString()).toBe('6000');
    });
  });

  describe('generation result', () => {
    it('returns correct summary stats', () => {
      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-6',
        startDate: new Date(2024, 0, 10),
        academicYearStartDate: new Date(2024, 0, 10),
        academicYearStartDate: new Date(2024, 0, 10),
        academicYearEndDate: new Date(2024, 2, 31),
        billingCycle: 'monthly',
        billingDueDay: 5,
        gracePeriodDays: 5,
        recurringFee: dec('5000.00'),
        registrationFee: dec('1000.00'),
        calendarRows: [],
      };

      const result = generatePeriodsForEnrollment(input);

      // 1 registration + 3 recurring = 4
      expect(result.periodsCreated).toBe(4);
      // Registration period start is Jan 10, but monthly first period is Jan 1
      expect(result.earliestPeriodStart).toEqual(new Date(2024, 0, 1));
      // Last month is March, last day = Mar 31
      expect(result.latestPeriodEnd).toEqual(new Date(2024, 2, 31));
      // Total: 1000 + 5000 + 5000 + 5000 = 16000
      expect(result.totalAmountDue.toString()).toBe('16000');
    });

    it('returns earliest/latest including registration period', () => {
      const rows = [
        { periodStart: new Date(2024, 8, 15), periodEnd: new Date(2024, 11, 31), dueDate: new Date(2024, 8, 20) },
        { periodStart: new Date(2025, 0, 1), periodEnd: new Date(2025, 3, 30), dueDate: new Date(2025, 0, 10) },
        { periodStart: new Date(2025, 4, 1), periodEnd: new Date(2025, 5, 30), dueDate: new Date(2025, 4, 10) },
      ];

      const input: GeneratePeriodsInput = {
        enrollmentId: 'enr-6',
        startDate: new Date(2024, 8, 10), // Sep 10 — before first period_start of Sep 15
        academicYearStartDate: new Date(2024, 8, 10),
        academicYearEndDate: new Date(2025, 5, 30),
        billingCycle: 'trimester',
        billingDueDay: 10,
        gracePeriodDays: 5,
        recurringFee: dec('10000.00'),
        registrationFee: dec('500.00'),
        calendarRows: rows,
      };

      const result = generatePeriodsForEnrollment(input);

      // Registration period starts on Sep 10, which is earlier than first trimester's Sep 15
      expect(result.earliestPeriodStart).toEqual(new Date(2024, 8, 10));
      expect(result.latestPeriodEnd).toEqual(new Date(2025, 5, 30));
    });
  });
});