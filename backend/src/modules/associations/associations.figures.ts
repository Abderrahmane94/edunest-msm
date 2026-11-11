/**
 * An association's figures: each club's, and the association's total. Numbers
 * only — no child, parent or staff member is named, no class either.
 */

export interface ClubFigures {
  id: string;
  name: string;
  wilaya: string;
  /** False when the club's account is closed (deactivated, trial over). */
  isOpen: boolean;
  children: { active: number; newInMonth: number };
  staff: { teachers: number; office: number; other: number; total: number };
  classrooms: { count: number; capacity: number; enrolled: number };
  attendance: {
    today: { isSchoolDay: boolean; expected: number; present: number; late: number; absent: number };
    /** Present or late over every mark taken in the month; null without marks. */
    month: { rate: number | null; marks: number; attended: number };
  };
  finance: {
    collected: number;
    expenses: number;
    salaries: number;
    net: number;
    /** Past the grace date and not fully paid, today. */
    late: { amount: number; children: number };
    /** Paid over owed for what has fallen due this school year; null if nothing is due yet. */
    recoveryRate: number | null;
  };
}

export type AssociationTotals = Omit<ClubFigures, 'id' | 'name' | 'wilaya' | 'isOpen' | 'finance'> & {
  clubs: number;
  finance: Omit<ClubFigures['finance'], 'recoveryRate'>;
};

/** A group as its officer sees it: its name, and what its client calls it and its nurseries. */
export interface AssociationView {
  id: string;
  name: string;
  groupTerm: string;
  memberTerm: string;
}

export interface AssociationOverview {
  association: AssociationView;
  /** YYYY-MM: the month the money, the new children and the month's attendance cover. */
  month: string;
  /** The date today (YYYY-MM-DD): what today's attendance and the late payments are as of. */
  today: string;
  totals: AssociationTotals;
  clubs: ClubFigures[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Present or late over the marks, in percent to one decimal; null without marks. */
export const attendanceRate = (attended: number, marks: number): number | null =>
  marks > 0 ? Math.round((attended / marks) * 1000) / 10 : null;

/** The association's total: counts and money add up; the month's rate is over all the marks. */
export function totalsOf(clubs: ClubFigures[]): AssociationTotals {
  const sum = (pick: (c: ClubFigures) => number) => clubs.reduce((total, c) => total + pick(c), 0);
  const marks = sum((c) => c.attendance.month.marks);
  const attended = sum((c) => c.attendance.month.attended);
  return {
    clubs: clubs.length,
    children: { active: sum((c) => c.children.active), newInMonth: sum((c) => c.children.newInMonth) },
    staff: {
      teachers: sum((c) => c.staff.teachers),
      office: sum((c) => c.staff.office),
      other: sum((c) => c.staff.other),
      total: sum((c) => c.staff.total),
    },
    classrooms: {
      count: sum((c) => c.classrooms.count),
      capacity: sum((c) => c.classrooms.capacity),
      enrolled: sum((c) => c.classrooms.enrolled),
    },
    attendance: {
      today: {
        isSchoolDay: clubs.some((c) => c.attendance.today.isSchoolDay),
        expected: sum((c) => c.attendance.today.expected),
        present: sum((c) => c.attendance.today.present),
        late: sum((c) => c.attendance.today.late),
        absent: sum((c) => c.attendance.today.absent),
      },
      month: { rate: attendanceRate(attended, marks), marks, attended },
    },
    finance: {
      collected: round2(sum((c) => c.finance.collected)),
      expenses: round2(sum((c) => c.finance.expenses)),
      salaries: round2(sum((c) => c.finance.salaries)),
      net: round2(sum((c) => c.finance.net)),
      late: { amount: round2(sum((c) => c.finance.late.amount)), children: sum((c) => c.finance.late.children) },
    },
  };
}

// ─── The evolution, month by month ───

export interface MonthPoint {
  /** YYYY-MM */
  month: string;
  collected: number;
  expenses: number;
  salaries: number;
  net: number;
  /** Children whose enrolment date falls in the month (among those still enrolled). */
  newChildren: number;
  marks: number;
  attended: number;
  /** Present or late over the month's marks; null without marks. */
  rate: number | null;
}

export interface AssociationTrend {
  months: string[];
  totals: MonthPoint[];
  clubs: { id: string; name: string; points: MonthPoint[] }[];
}

/** The `count` months ending with `until` (YYYY-MM), oldest first. */
export function monthsEnding(until: string, count: number): string[] {
  const [year, month] = until.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

/** One club's rows, put in their months. Rows outside the months are left out. */
export function pointsOf(
  months: string[],
  rows: {
    payments: { date: Date; amount: number }[];
    expenses: { date: Date; amount: number }[];
    salaries: { date: Date; amount: number }[];
    children: { date: Date }[];
    marks: { date: Date; status: string; count: number }[];
  },
): MonthPoint[] {
  const points = new Map(
    months.map((month) => [month, { month, collected: 0, expenses: 0, salaries: 0, net: 0, newChildren: 0, marks: 0, attended: 0, rate: null as number | null }]),
  );
  const at = (d: Date) => points.get(monthOf(d));
  for (const r of rows.payments) { const p = at(r.date); if (p) p.collected += r.amount; }
  for (const r of rows.expenses) { const p = at(r.date); if (p) p.expenses += r.amount; }
  for (const r of rows.salaries) { const p = at(r.date); if (p) p.salaries += r.amount; }
  for (const r of rows.children) { const p = at(r.date); if (p) p.newChildren += 1; }
  for (const r of rows.marks) {
    const p = at(r.date);
    if (!p) continue;
    p.marks += r.count;
    if (r.status !== 'absent') p.attended += r.count;
  }
  return months.map((month) => finish(points.get(month)!));
}

function finish(p: MonthPoint): MonthPoint {
  const collected = round2(p.collected);
  const expenses = round2(p.expenses);
  const salaries = round2(p.salaries);
  return { ...p, collected, expenses, salaries, net: round2(collected - expenses - salaries), rate: attendanceRate(p.attended, p.marks) };
}

/** The association's months: each club's added up, the rate over all the marks. */
export function sumPoints(months: string[], clubs: MonthPoint[][]): MonthPoint[] {
  return months.map((month, i) =>
    finish(
      clubs.reduce<MonthPoint>(
        (total, points) => {
          const p = points[i];
          return {
            month,
            collected: total.collected + p.collected,
            expenses: total.expenses + p.expenses,
            salaries: total.salaries + p.salaries,
            net: 0,
            newChildren: total.newChildren + p.newChildren,
            marks: total.marks + p.marks,
            attended: total.attended + p.attended,
            rate: null,
          };
        },
        { month, collected: 0, expenses: 0, salaries: 0, net: 0, newChildren: 0, marks: 0, attended: 0, rate: null },
      ),
    ),
  );
}
