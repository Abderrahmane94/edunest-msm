import { Prisma } from '@prisma/client';
import { DerivedPeriodStatus } from './payments.types';

// --- Billing Period Generation Types ---

export interface GeneratePeriodsInput {
  enrollmentId: string;
  startDate: Date;
  academicYearStartDate: Date;
  academicYearEndDate: Date;
  billingCycle: 'monthly' | 'custom';
  billingDueDay: number;
  gracePeriodDays: number;
  recurringFee: Prisma.Decimal;
  registrationFee: Prisma.Decimal | null;
  /** Explicit override for the first (possibly partial) period's amount — bypasses automatic proration. */
  firstPeriodAmountDue?: Prisma.Decimal;
  calendarRows: Array<{ periodStart: Date; periodEnd: Date }>;
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

/**
 * Counts calendar days between two dates, inclusive of both endpoints.
 * Uses UTC components so DST transitions never shift the count.
 */
function daysBetweenInclusive(start: Date, end: Date): number {
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((utcEnd - utcStart) / 86400000) + 1;
}

/**
 * Prorates a period's amount by the fraction of it actually covered,
 * starting from `effectiveStart` through `periodEnd`, rounded to 2 decimals.
 * Used for a mid-period enrollment start (a partial first month/period).
 */
export function prorateAmount(
  fullAmount: Prisma.Decimal,
  periodStart: Date,
  periodEnd: Date,
  effectiveStart: Date
): Prisma.Decimal {
  const totalDays = daysBetweenInclusive(periodStart, periodEnd);
  const coveredDays = daysBetweenInclusive(effectiveStart, periodEnd);
  return fullAmount.times(coveredDays).dividedBy(totalDays).toDecimalPlaces(2);
}

/**
 * Resolves a due date from the fee's configured day-of-month, anchored to
 * the month a period starts in.
 */
function dueDateForPeriod(periodStart: Date, billingDueDay: number): Date {
  return new Date(periodStart.getFullYear(), periodStart.getMonth(), billingDueDay);
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
 * - Custom: uses calendarRows filtered by periodEnd >= startDate, requires >= 1 row
 * - Registration period: generated when registrationFee is non-null
 * - First period proration: when startDate falls after the first recurring period's
 *   periodStart (a mid-period enrollment), that period's amount is automatically
 *   prorated by the fraction of days actually covered — unless firstPeriodAmountDue
 *   is explicitly provided, which takes precedence over the automatic proration.
 */
export function generatePeriodsForEnrollment(input: GeneratePeriodsInput): GenerationResult {
  const {
    enrollmentId,
    startDate,
    academicYearStartDate,
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
    academicYearStartDate,
    academicYearEndDate,
    billingCycle,
    billingDueDay,
    gracePeriodDays,
    recurringFee,
    calendarRows
  );

  // Mid-cycle enrollment: automatically prorate the first recurring period by
  // days actually covered, unless an explicit override is provided.
  if (recurringPeriods.length > 0 && startDate > recurringPeriods[0].periodStart) {
    recurringPeriods[0] = {
      ...recurringPeriods[0],
      amountDue:
        firstPeriodAmountDue !== undefined
          ? firstPeriodAmountDue
          : prorateAmount(recurringFee, recurringPeriods[0].periodStart, recurringPeriods[0].periodEnd, startDate),
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
  academicYearStartDate: Date,
  academicYearEndDate: Date,
  billingCycle: 'monthly' | 'custom',
  billingDueDay: number,
  gracePeriodDays: number,
  recurringFee: Prisma.Decimal,
  calendarRows: Array<{ periodStart: Date; periodEnd: Date }>
): GeneratedPeriod[] {
  switch (billingCycle) {
    case 'monthly':
      return generateMonthlyPeriods(
        enrollmentId,
        startDate,
        academicYearStartDate,
        academicYearEndDate,
        billingDueDay,
        gracePeriodDays,
        recurringFee
      );
    case 'custom':
      return generateCalendarPeriods(
        enrollmentId,
        startDate,
        billingDueDay,
        gracePeriodDays,
        recurringFee,
        calendarRows
      );
  }
}

/**
 * Generates monthly billing periods.
 *
 * The effective start month is the LATER of:
 *   - the month containing the enrollment startDate
 *   - the month containing the academic year start date
 *
 * This prevents generating periods for months before the academic year
 * (e.g. enrollment in August when the school year starts in September).
 */
function generateMonthlyPeriods(
  enrollmentId: string,
  startDate: Date,
  academicYearStartDate: Date,
  academicYearEndDate: Date,
  billingDueDay: number,
  gracePeriodDays: number,
  recurringFee: Prisma.Decimal
): GeneratedPeriod[] {
  const periods: GeneratedPeriod[] = [];

  // Use the later of startDate's month and academic year start month
  const effectiveStart = startDate > academicYearStartDate ? startDate : academicYearStartDate;

  const startYear = effectiveStart.getFullYear();
  const startMonth = effectiveStart.getMonth();
  const endYear = academicYearEndDate.getFullYear();
  const endMonth = academicYearEndDate.getMonth();

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const periodStart = firstDayOfMonth(year, month);
    const periodEnd = lastDayOfMonth(year, month);
    const dueDate = dueDateForPeriod(periodStart, billingDueDay);
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
 * Generates billing periods from BranchCalendar rows for the custom cycle.
 * Filters rows by periodEnd >= startDate, then validates count.
 */
function generateCalendarPeriods(
  enrollmentId: string,
  startDate: Date,
  billingDueDay: number,
  gracePeriodDays: number,
  recurringFee: Prisma.Decimal,
  calendarRows: Array<{ periodStart: Date; periodEnd: Date }>
): GeneratedPeriod[] {
  // Filter to rows where periodEnd >= startDate
  const filteredRows = calendarRows.filter((row) => row.periodEnd >= startDate);

  if (filteredRows.length < 1) {
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
    const dueDate = dueDateForPeriod(row.periodStart, billingDueDay);
    const graceEndDate = addDays(dueDate, gracePeriodDays);

    return {
      enrollmentId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      dueDate,
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
