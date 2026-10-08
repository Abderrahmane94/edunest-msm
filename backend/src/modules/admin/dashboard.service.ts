import { AttendanceStatus, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

/**
 * The school director's dashboard: today's attendance and daily reports,
 * the month's money, enrolment and class fill, and what needs an answer.
 * All figures cover the whole school (every branch).
 */

const SCHOOL_TIME_ZONE = 'Africa/Algiers';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_WORKING_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
/** A parent is "waiting" when their message has had no reply for this long. */
const WAITING_AFTER_MS = 3 * 60 * 60 * 1000;
const MONTHS_IN_CHART = 6;
const WEEKS_IN_CHART = 4;
const UPCOMING_EVENT_DAYS = 7;

export interface AdminDashboard {
  /** The school's date today, YYYY-MM-DD. */
  today: string;
  schoolName: string;
  attendance: {
    /** False on a day off for every class (weekend). */
    isSchoolDay: boolean;
    /** Children expected today (in a class that works today). */
    expected: number;
    present: number;
    late: number;
    absent: number;
    /** Classes that work today, have children, and whose roll call isn't taken. */
    missingClassrooms: { id: string; name: string; teacherName: string | null; childCount: number }[];
    /** Classes that work today and have children. */
    classroomsToday: number;
    /** Present or late over all marks, per week (oldest first); null without marks. */
    weeks: { weekStart: string; rate: number | null }[];
  };
  dailyReports: { sent: number; expected: number };
  finance: {
    /** YYYY-MM */
    month: string;
    collected: number;
    collectedPreviousMonth: number;
    expenses: number;
    salaries: number;
    net: number;
    late: { amount: number; children: number };
    /** Paid over owed, for what has fallen due this school year; null if nothing is due yet. */
    recoveryRate: number | null;
    /** Collected per month (oldest first). */
    monthly: { month: string; collected: number }[];
  };
  enrollment: {
    activeChildren: number;
    newThisMonth: number;
    classrooms: { id: string; name: string; capacity: number; enrolled: number }[];
  };
  communication: {
    waitingParents: number;
    pendingConsents: number;
    upcomingEvents: { id: string; title: string; startDatetime: string; location: string | null }[];
  };
}

// ─── Dates (in the school's time zone; @db.Date columns are UTC midnights) ───

/** The school's calendar date at `now`, as YYYY-MM-DD. */
export function schoolToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dayString = (d: Date) => d.toISOString().slice(0, 10);

function addDays(day: string, days: number): string {
  const d = asDate(day);
  d.setUTCDate(d.getUTCDate() + days);
  return dayString(d);
}

/** First day of the month `offset` months from `day`'s month, YYYY-MM-DD. */
function monthStart(day: string, offset = 0): string {
  const d = asDate(day.slice(0, 7) + '-01');
  d.setUTCMonth(d.getUTCMonth() + offset);
  return dayString(d);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

// ─── Pure calculations ───

export function attendanceWeeks(
  rows: { date: Date; status: AttendanceStatus; count: number }[],
  today: string,
): { weekStart: string; rate: number | null }[] {
  // Rolling 7-day weeks ending today: the last one is "the last 7 days".
  const weeks = Array.from({ length: WEEKS_IN_CHART }, (_, i) => {
    const weekStart = addDays(today, -7 * (WEEKS_IN_CHART - i) + 1);
    return { weekStart, attended: 0, total: 0 };
  });
  for (const row of rows) {
    const day = dayString(row.date);
    const week = [...weeks].reverse().find((w) => day >= w.weekStart);
    if (!week || day > today) continue;
    week.total += row.count;
    if (row.status !== 'absent') week.attended += row.count;
  }
  return weeks.map((w) => ({ weekStart: w.weekStart, rate: percent(w.attended, w.total) }));
}

export function summarizePeriods(
  periods: {
    childId: string;
    academicYearId: string;
    amountDue: Prisma.Decimal;
    paid: Prisma.Decimal;
    dueDate: Date;
    graceEndDate: Date;
  }[],
  today: string,
  activeAcademicYearId: string | null,
): { late: { amount: number; children: number }; recoveryRate: number | null } {
  const todayDate = asDate(today);
  let lateAmount = new Prisma.Decimal(0);
  const lateChildren = new Set<string>();
  let owed = new Prisma.Decimal(0);
  let paidOnOwed = new Prisma.Decimal(0);

  for (const p of periods) {
    const outstanding = p.amountDue.minus(p.paid);
    // Late, as on the late payments page: past the grace date and not fully paid.
    if (todayDate > p.graceEndDate && outstanding.gt(0)) {
      lateAmount = lateAmount.add(outstanding);
      lateChildren.add(p.childId);
    }
    if (p.dueDate <= todayDate && (!activeAcademicYearId || p.academicYearId === activeAcademicYearId)) {
      owed = owed.add(p.amountDue);
      paidOnOwed = paidOnOwed.add(Prisma.Decimal.min(Prisma.Decimal.max(p.paid, 0), p.amountDue));
    }
  }

  return {
    late: { amount: round2(lateAmount.toNumber()), children: lateChildren.size },
    recoveryRate: owed.gt(0) ? percent(paidOnOwed.toNumber(), owed.toNumber()) : null,
  };
}

export function collectedByMonth(
  records: { valueDate: Date; totalAmount: Prisma.Decimal }[],
  months: string[],
): { month: string; collected: number }[] {
  const totals = new Map(months.map((m) => [m, new Prisma.Decimal(0)]));
  for (const r of records) {
    const month = dayString(r.valueDate).slice(0, 7);
    const total = totals.get(month);
    // Corrections are stored with a negative amount: the sum is what was really kept.
    if (total) totals.set(month, total.add(r.totalAmount));
  }
  return months.map((month) => ({ month, collected: round2(totals.get(month)!.toNumber()) }));
}

// ─── Data ───

export const dashboardService = {
  async getAdminDashboard(schoolId: string, now: Date = new Date()): Promise<AdminDashboard> {
    const today = schoolToday(now);
    const todayDate = asDate(today);
    const weekday = DAY_NAMES[todayDate.getUTCDay()];
    const thisMonth = monthStart(today);
    const nextMonth = monthStart(today, 1);
    const previousMonth = monthStart(today, -1);
    const chartMonths = Array.from({ length: MONTHS_IN_CHART }, (_, i) =>
      monthStart(today, i - MONTHS_IN_CHART + 1).slice(0, 7),
    );
    const chartStart = asDate(`${chartMonths[0]}-01`);
    const weeksStart = asDate(addDays(today, -7 * WEEKS_IN_CHART + 1));
    const activeChild = { isActive: true, deletedAt: null };

    const [school, activeYear] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      prisma.academicYear.findFirst({ where: { schoolId, isActive: true }, select: { id: true } }),
    ]);

    const [
      classrooms,
      todayMarks,
      weekRows,
      reportsToday,
      activeChildren,
      newThisMonth,
      periods,
      payments,
      expenses,
      salaries,
      waitingConversations,
      pendingConsents,
      upcomingEvents,
    ] = await Promise.all([
      prisma.classroom.findMany({
        where: { schoolId, deletedAt: null, ...(activeYear && { academicYearId: activeYear.id }) },
        select: {
          id: true,
          name: true,
          capacity: true,
          workingDays: true,
          teacher: { select: { firstName: true, lastName: true } },
          enrollments: { where: { child: activeChild }, select: { childId: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.attendanceRecord.findMany({
        where: { schoolId, date: todayDate },
        select: { classroomId: true, childId: true, status: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ['date', 'status'],
        where: { schoolId, date: { gte: weeksStart, lte: todayDate } },
        _count: { _all: true },
      }),
      prisma.dailyReport.count({ where: { schoolId, date: todayDate } }),
      prisma.child.count({ where: { schoolId, ...activeChild } }),
      prisma.child.count({
        where: { schoolId, ...activeChild, enrollmentDate: { gte: asDate(thisMonth), lt: asDate(nextMonth) } },
      }),
      prisma.billingPeriod.findMany({
        where: { enrollment: { branch: { schoolId } }, cancelledAt: null, dueDate: { lte: todayDate } },
        select: {
          amountDue: true,
          dueDate: true,
          graceEndDate: true,
          enrollment: { select: { childId: true, academicYearId: true } },
          paymentAllocations: { select: { amount: true } },
        },
      }),
      prisma.paymentRecord.findMany({
        where: { branch: { schoolId }, valueDate: { gte: chartStart, lt: asDate(nextMonth) } },
        select: { valueDate: true, totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { schoolId, date: { gte: asDate(thisMonth), lt: asDate(nextMonth) } },
        _sum: { amount: true },
      }),
      prisma.salaryPayment.aggregate({
        where: { schoolId, deletedAt: null, paidAt: { gte: asDate(thisMonth), lt: asDate(nextMonth) } },
        _sum: { netSalary: true },
      }),
      // Last message older than the wait: whether it was the parent's is checked below.
      prisma.conversation.findMany({
        where: { schoolId, lastMessageAt: { lte: new Date(now.getTime() - WAITING_AFTER_MS) } },
        select: {
          parentUserId: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { senderUserId: true } },
        },
      }),
      prisma.consentForm.count({
        where: { status: 'pending', event: { schoolId, startDatetime: { gte: now } } },
      }),
      prisma.event.findMany({
        where: {
          schoolId,
          startDatetime: { gte: now, lt: new Date(now.getTime() + UPCOMING_EVENT_DAYS * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, title: true, startDatetime: true, location: true },
        orderBy: { startDatetime: 'asc' },
        take: 5,
      }),
    ]);

    // Today's roll call
    const workingToday = classrooms.filter((c) => {
      const days = Array.isArray(c.workingDays) ? (c.workingDays as string[]) : DEFAULT_WORKING_DAYS;
      return days.includes(weekday) && c.enrollments.length > 0;
    });
    const expectedChildren = new Set(workingToday.flatMap((c) => c.enrollments.map((e) => e.childId)));
    const markedClassrooms = new Set(todayMarks.map((m) => m.classroomId));
    const count = (status: AttendanceStatus) => todayMarks.filter((m) => m.status === status).length;
    const present = count('present');
    const late = count('late');

    const { late: latePayments, recoveryRate } = summarizePeriods(
      periods.map((p) => ({
        childId: p.enrollment.childId,
        academicYearId: p.enrollment.academicYearId,
        amountDue: p.amountDue,
        paid: p.paymentAllocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0)),
        dueDate: p.dueDate,
        graceEndDate: p.graceEndDate,
      })),
      today,
      activeYear?.id ?? null,
    );

    const monthly = collectedByMonth(payments, chartMonths);
    const collected = monthly[monthly.length - 1].collected;
    const collectedPreviousMonth =
      monthly.find((m) => m.month === previousMonth.slice(0, 7))?.collected ?? 0;
    const expensesTotal = round2(expenses._sum.amount?.toNumber() ?? 0);
    const salariesTotal = round2(salaries._sum.netSalary?.toNumber() ?? 0);

    return {
      today,
      schoolName: school?.name ?? '',
      attendance: {
        isSchoolDay: workingToday.length > 0,
        expected: expectedChildren.size,
        present,
        late,
        absent: count('absent'),
        missingClassrooms: workingToday
          .filter((c) => !markedClassrooms.has(c.id))
          .map((c) => ({
            id: c.id,
            name: c.name,
            teacherName: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}`.trim() : null,
            childCount: c.enrollments.length,
          })),
        classroomsToday: workingToday.length,
        weeks: attendanceWeeks(
          weekRows.map((r) => ({ date: r.date, status: r.status, count: r._count._all })),
          today,
        ),
      },
      dailyReports: { sent: reportsToday, expected: present + late },
      finance: {
        month: thisMonth.slice(0, 7),
        collected,
        collectedPreviousMonth,
        expenses: expensesTotal,
        salaries: salariesTotal,
        net: round2(collected - expensesTotal - salariesTotal),
        late: latePayments,
        recoveryRate,
        monthly,
      },
      enrollment: {
        activeChildren,
        newThisMonth,
        classrooms: classrooms.map((c) => ({
          id: c.id,
          name: c.name,
          capacity: c.capacity,
          enrolled: c.enrollments.length,
        })),
      },
      communication: {
        waitingParents: waitingConversations.filter((c) => c.messages[0]?.senderUserId === c.parentUserId).length,
        pendingConsents,
        upcomingEvents: upcomingEvents.map((e) => ({
          id: e.id,
          title: e.title,
          startDatetime: e.startDatetime.toISOString(),
          location: e.location,
        })),
      },
    };
  },
};
