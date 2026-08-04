import { Prisma } from '@prisma/client';
import { DerivedPeriodStatus } from './payments.types';

// --- Billing Period Generation Types ---

export interface GeneratePeriodsInput {
  enrollmentId: string;
  startDate: Date;
  academicYearEndDate: Date;
  billingCycle: 'monthly' | 'trimester' | 'custom';
  billingDueDay: number;
  gracePeriodDays: number;
  recurringFee: Prisma.Decimal;
  registrationFee: Prisma.Decimal | null;
  firstPeriodAmountDue?: Prisma.Decimal;
  calendarRows: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }>;
}

export interface GeneratedPeriod {
  enrollmentId: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  graceEndDate: Date;
  amountDue: Prisma.Decimal;
  isRegistrationPeriod: boolean;
}

export interface GenerationResult {
  periods: GeneratedPeriod[];
  periodsCreated: number;
  earliestPeriodStart: Date;
  latestPeriodEnd: Date;
  totalAmountDue: Prisma.Decimal;
}

// --- Helper Functions ---

/**
 * Adds a number of calendar days to a date, returning a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns the last day of the month for the given year and month (0-indexed).
 */
function lastDayOfMonth(year: number, month: number): Date {
  // Day 0 of next month = last day of current month
  return new Date(year, month + 1, 0);
}

/**
 * Returns the first day of the month for the given year and month (0-indexed).
 */
function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

// --- Period Generation ---

/**
 * Generates billing periods for an enrollment based on the billing cycle configuration.
 *
 * This is a pure function that accepts all needed parameters rather than querying the DB.
 * The enrollment service is responsible for fetching data and calling this function.
 *
 * Generation rules:
 * - Monthly: one period per calendar month from startDate's month through academicYearEndDate's month
 * - Trimester: uses calendarRows filtered by periodEnd >= startDate, requires exactly 3 rows
 * - Custom: uses calendarRows filtered by periodEnd >= startDate, requires >= 1 row
 * - Registration period: generated when registrationFee is non-null
 * - First period override: applied when firstPeriodAmountDue is provided AND startDate > first period's periodStart
 */
export function generatePeriodsForEnrollment(input: GeneratePeriodsInput): GenerationResult {
  const {
    enrollmentId,
    startDate,
    academicYearEndDate,
    billingCycle,
    billingDueDay,
    gracePeriodDays,
    recurringFee,
    registrationFee,
    firstPeriodAmountDue,
    calendarRows,
  } = input;

  const recurringPeriods = generateRecurringPeriods(
    enrollmentId,
    startDate,
    academicYearEndDate,
    billingCycle,
    billingDueDay,
    gracePeriodDays,
    recurringFee,
    calendarRows
  );

  // Apply first-period amount override for mid-cycle enrollment
  if (
    firstPeriodAmountDue !== undefined &&
    recurringPeriods.length > 0 &&
    startDate > recurringPeriods[0].periodStart
  ) {
    recurringPeriods[0] = {
      ...recurringPeriods[0],
      amountDue: firstPeriodAmountDue,
    };
  }

  // Generate registration period if registrationFee is non-null
  const allPeriods: GeneratedPeriod[] = [];

  if (registrationFee !== null) {
    const registrationPeriod: GeneratedPeriod = {
      enrollmentId,
      periodStart: startDate,
      periodEnd: startDate,
      dueDate: startDate,
      graceEndDate: addDays(startDate, gracePeriodDays),
      amountDue: registrationFee,
      isRegistrationPeriod: true,
    };
    allPeriods.push(registrationPeriod);
  }

  allPeriods.push(...recurringPeriods);

  // Compute generation result
  const periodsCreated = allPeriods.length;
  const earliestPeriodStart = allPeriods.reduce(
    (min, p) => (p.periodStart < min ? p.periodStart : min),
    allPeriods[0].periodStart
  );
  const latestPeriodEnd = allPeriods.reduce(
    (max, p) => (p.periodEnd > max ? p.periodEnd : max),
    allPeriods[0].periodEnd
  );
  const totalAmountDue = allPeriods.reduce(
    (sum, p) => sum.plus(p.amountDue),
    new Prisma.Decimal(0)
  );

  return {
    periods: allPeriods,
    periodsCreated,
    earliestPeriodStart,
    latestPeriodEnd,
    totalAmountDue,
  };
}

/**
 * Generates recurring (non-registration) billing periods based on the billing cycle.
 */
function generateRecurringPeriods(
  enrollmentId: string,
  startDate: Date,
  academicYearEndDate: Date,
  billingCycle: 'monthly' | 'trimester' | 'custom',
  billingDueDay: number,
  gracePeriodDays: number,
  recurringFee: Prisma.Decimal,
  calendarRows: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }>
): GeneratedPeriod[] {
  switch (billingCycle) {
    case 'monthly':
      return generateMonthlyPeriods(
        enrollmentId,
        startDate,
        academicYearEndDate,
        billingDueDay,
        gracePeriodDays,
        recurringFee
      );
    case 'trimester':
      return generateCalendarPeriods(
        enrollmentId,
        startDate,
        gracePeriodDays,
        recurringFee,
        calendarRows,
        'trimester'
      );
    case 'custom':
      return generateCalendarPeriods(
        enrollmentId,
        startDate,
        gracePeriodDays,
        recurringFee,
        calendarRows,
        'custom'
      );
  }
}

/**
 * Generates monthly billing periods from startDate's month through academicYearEndDate's month.
 */
function generateMonthlyPeriods(
  enrollmentId: string,
  startDate: Date,
  academicYearEndDate: Date,
  billingDueDay: number,
  gracePeriodDays: number,
  recurringFee: Prisma.Decimal
): GeneratedPeriod[] {
  const periods: GeneratedPeriod[] = [];

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endYear = academicYearEndDate.getFullYear();
  const endMonth = academicYearEndDate.getMonth();

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const periodStart = firstDayOfMonth(year, month);
    const periodEnd = lastDayOfMonth(year, month);
    const dueDate = new Date(year, month, billingDueDay);
    const graceEndDate = addDays(dueDate, gracePeriodDays);

    periods.push({
      enrollmentId,
      periodStart,
      periodEnd,
      dueDate,
      graceEndDate,
      amountDue: recurringFee,
      isRegistrationPeriod: false,
    });

    // Advance to next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return periods;
}

/**
 * Generates billing periods from BranchCalendar rows for trimester or custom cycles.
 * Filters rows by periodEnd >= startDate, then validates count.
 */
function generateCalendarPeriods(
  enrollmentId: string,
  startDate: Date,
  gracePeriodDays: number,
  recurringFee: Prisma.Decimal,
  calendarRows: Array<{ periodStart: Date; periodEnd: Date; dueDate: Date }>,
  cycleType: 'trimester' | 'custom'
): GeneratedPeriod[] {
  // Filter to rows where periodEnd >= startDate
  const filteredRows = calendarRows.filter((row) => row.periodEnd >= startDate);

  // Validate row count
  if (cycleType === 'trimester' && filteredRows.length !== 3) {
    throw new Error(
      `Trimester billing cycle requires exactly 3 calendar rows after filtering by start date, but found ${filteredRows.length}. ` +
        `Expected 3, found ${filteredRows.length}.`
    );
  }
  if (cycleType === 'custom' && filteredRows.length < 1) {
    throw new Error(
      'Custom billing cycle requires at least 1 calendar row after filtering by start date, but found 0. ' +
        'Please configure BranchCalendar entries for this branch and academic year.'
    );
  }

  // Sort by periodStart ascending
  const sortedRows = [...filteredRows].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime()
  );

  // Generate periods from sorted rows
  return sortedRows.map((row) => {
    const graceEndDate = addDays(row.dueDate, gracePeriodDays);

    return {
      enrollmentId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      dueDate: row.dueDate,
      graceEndDate,
      amountDue: recurringFee,
      isRegistrationPeriod: false,
    };
  });
}

/**
 * Derives the payment status of a billing period from the payment ledger.
 *
 * Status is computed on each read rather than stored, ensuring it always
 * reflects the current state of the ledger and the calendar date.
 *
 * Status rules:
 * - `paid`: totalPaid >= amountDue
 * - `partial`: 0 < totalPaid < amountDue AND currentDate <= graceEndDate
 * - `late_partial`: 0 < totalPaid < amountDue AND currentDate > graceEndDate
 * - `unpaid`: totalPaid <= 0 AND currentDate <= graceEndDate
 * - `late`: totalPaid <= 0 AND currentDate > graceEndDate
 *
 * The `isLate` flag is true only when status is `late` or `late_partial`
 * AND the period has not been cancelled (cancelledAt is null).
 *
 * @param amountDue - The amount owed for the billing period (DZD, 2 decimal places)
 * @param totalPaid - Sum of all payment allocations against this period (DZD, may be negative due to corrections)
 * @param graceEndDate - The date after which unpaid/partial periods become late
 * @param currentDate - The current date in the school's configured time zone (date-only comparison)
 * @param cancelledAt - Timestamp when the period was cancelled, or null if active
 * @returns The derived period status with isLate flag, totalPaid, and outstanding amount
 */
export function derivePeriodStatus(
  amountDue: Prisma.Decimal,
  totalPaid: Prisma.Decimal,
  graceEndDate: Date,
  currentDate: Date,
  cancelledAt: Date | null
): DerivedPeriodStatus {
  const isAfterGrace = currentDate > graceEndDate;
  const outstanding = amountDue.minus(totalPaid);

  let status: 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
  if (totalPaid.gte(amountDue)) {
    status = 'paid';
  } else if (totalPaid.gt(new Prisma.Decimal(0))) {
    status = isAfterGrace ? 'late_partial' : 'partial';
  } else {
    status = isAfterGrace ? 'late' : 'unpaid';
  }

  const isLate = cancelledAt
    ? false
    : status === 'late' || status === 'late_partial';

  return { status, isLate, totalPaid, outstanding };
}
