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

export interface AssociationOverview {
  association: { id: string; name: string };
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
