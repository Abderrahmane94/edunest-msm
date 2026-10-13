/**
 * The team's planning, worked out from three things: each person's usual week
 * (their shifts, the same every week or alternating week A / week B), the
 * absences recorded, and the replacements of teachers. Dates are days
 * ("YYYY-MM-DD"), times are "HH:MM"; nothing here depends on a time zone.
 */

export type WeekType = 'a' | 'b';
export type ShiftWeek = 'all' | WeekType;

export interface Shift {
  /** 0: Sunday … 6: Saturday. */
  weekday: number;
  week: ShiftWeek;
  start: string;
  end: string;
}

export interface AbsenceSpan {
  startDate: string;
  endDate: string;
  reason: string;
}

const DAY_MS = 86400000;
/** A Sunday: weeks are counted from it, so week A and week B alternate without a gap at new year. */
const FIRST_WEEK_A = Date.UTC(2024, 0, 7);

const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  return iso(utc(day) + n * DAY_MS);
}

export function weekdayOf(day: string): number {
  return new Date(utc(day)).getUTCDay();
}

/** The Sunday the day's week starts on. */
export function weekStartOf(day: string): string {
  return addDays(day, -weekdayOf(day));
}

/** Whether the day is in a week A or a week B. */
export function weekTypeOf(day: string): WeekType {
  const weeks = Math.floor((utc(weekStartOf(day)) - FIRST_WEEK_A) / (7 * DAY_MS));
  return ((weeks % 2) + 2) % 2 === 0 ? 'a' : 'b';
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** First and last day of a month ("YYYY-MM"). */
export function monthBounds(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  return [iso(Date.UTC(y, m - 1, 1)), iso(Date.UTC(y, m, 0))];
}

export function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function shiftMinutes(shifts: Pick<Shift, 'start' | 'end'>[]): number {
  return shifts.reduce((n, s) => n + Math.max(0, minutesOf(s.end) - minutesOf(s.start)), 0);
}

/** The person's shifts on that day, in order. */
export function shiftsOn<T extends Shift>(shifts: T[], day: string): T[] {
  const weekday = weekdayOf(day);
  const type = weekTypeOf(day);
  return shifts
    .filter((s) => s.weekday === weekday && (s.week === 'all' || s.week === type))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** What is wrong with a usual week, if anything (the message is shown as is). */
export function shiftsProblem(shifts: Shift[]): string | null {
  const alternating = shifts.some((s) => s.week !== 'all');
  if (alternating && shifts.some((s) => s.week === 'all')) return 'A usual week is the same every week or alternates, not both';
  for (const s of shifts) {
    if (minutesOf(s.end) <= minutesOf(s.start)) return 'A shift must end after it starts';
  }
  const keys = new Map<string, Shift[]>();
  for (const s of shifts) keys.set(`${s.week}:${s.weekday}`, [...(keys.get(`${s.week}:${s.weekday}`) ?? []), s]);
  for (const day of keys.values()) {
    if (day.length > 2) return 'At most two shifts a day';
    if (day.length === 2) {
      const [first, second] = [...day].sort((a, b) => a.start.localeCompare(b.start));
      if (minutesOf(second.start) < minutesOf(first.end)) return 'Two shifts of a day cannot overlap';
    }
  }
  return null;
}

/** The first absence that covers the day. */
export function absenceOn<T extends AbsenceSpan>(absences: T[], day: string): T | undefined {
  return absences.find((a) => a.startDate <= day && day <= a.endDate);
}

export interface MonthHours {
  /** Minutes of the usual week over the month. */
  plannedMinutes: number;
  /** Minutes of the days the person was away. */
  absentMinutes: number;
  workedMinutes: number;
  /** Days away, by reason. */
  absentDays: Record<string, number>;
  absentDaysTotal: number;
}

/**
 * A month of one person: hours planned, hours away, hours worked. A day away
 * counts when the person was due to work that day; for someone with no usual
 * week, every day away from Sunday to Thursday counts.
 */
export function monthHours(shifts: Shift[], absences: AbsenceSpan[], month: string, until?: string): MonthHours {
  const [first, last] = monthBounds(month);
  const out: MonthHours = { plannedMinutes: 0, absentMinutes: 0, workedMinutes: 0, absentDays: {}, absentDaysTotal: 0 };
  const hasWeek = shifts.length > 0;
  for (const day of daysBetween(first, until && until < last ? until : last)) {
    const due = shiftsOn(shifts, day);
    const minutes = shiftMinutes(due);
    out.plannedMinutes += minutes;
    const away = absenceOn(absences, day);
    const counts = hasWeek ? due.length > 0 : weekdayOf(day) <= 4;
    if (away && counts) {
      out.absentMinutes += minutes;
      out.absentDays[away.reason] = (out.absentDays[away.reason] ?? 0) + 1;
      out.absentDaysTotal += 1;
    }
  }
  out.workedMinutes = out.plannedMinutes - out.absentMinutes;
  return out;
}

export interface DayPresence {
  userId: string;
  shifts: Pick<Shift, 'start' | 'end'>[];
  away: boolean;
}

/**
 * Whether the day still opens and closes as usual: the first arrival and the
 * last departure of the usual week, and those of who is really there.
 * null when it does (or when nobody is due that day).
 */
export function openingGap(people: DayPresence[]): { opening?: { usual: string; actual: string | null }; closing?: { usual: string; actual: string | null } } | null {
  const bounds = (list: DayPresence[]) => {
    const all = list.flatMap((p) => p.shifts);
    if (all.length === 0) return null;
    return { start: all.map((s) => s.start).sort()[0], end: all.map((s) => s.end).sort().reverse()[0] };
  };
  const usual = bounds(people);
  if (!usual) return null;
  const actual = bounds(people.filter((p) => !p.away));
  const gap: NonNullable<ReturnType<typeof openingGap>> = {};
  if (!actual || actual.start > usual.start) gap.opening = { usual: usual.start, actual: actual?.start ?? null };
  if (!actual || actual.end < usual.end) gap.closing = { usual: usual.end, actual: actual?.end ?? null };
  return gap.opening || gap.closing ? gap : null;
}
