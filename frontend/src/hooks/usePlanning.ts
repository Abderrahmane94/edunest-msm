import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

export const ABSENCE_REASONS = ['illness', 'leave', 'unpaid', 'training', 'other'] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number];
export type ShiftWeek = 'all' | 'a' | 'b';

export interface Shift {
  /** 0: Sunday … 6: Saturday. */
  weekday: number;
  week: ShiftWeek;
  start: string;
  end: string;
}

export interface PlanningDay {
  date: string;
  shifts: { start: string; end: string }[];
  /** `id` starts with "substitution:" when it comes from a teacher's replacement. */
  absence: { id: string; reason: string; note: string | null; startDate: string; endDate: string; classroom: string | null } | null;
  replacing: { classroomId: string; classroom: string }[];
}

export interface PlanningPerson {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  position: string | null;
  classrooms: { id: string; name: string; color: string | null }[];
  template: Shift[];
  days: PlanningDay[];
}

export interface PlanningAlert {
  date: string;
  kind: 'class' | 'opening' | 'closing';
  classroom?: string;
  teacher?: string;
  usual?: string;
  actual?: string | null;
}

export interface PlanningWeek {
  start: string;
  days: string[];
  weekType: 'a' | 'b';
  alternates: boolean;
  people: PlanningPerson[];
  alerts: PlanningAlert[];
  /** The whole team (who manages it), or the signed-in person alone. */
  whole: boolean;
  today: string;
}

export interface Absence {
  id: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string };
  startDate: string;
  endDate: string;
  reason: AbsenceReason;
  note: string | null;
}

export interface MonthPerson {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  position: string | null;
  hasWeek: boolean;
  plannedMinutes: number;
  absentMinutes: number;
  workedMinutes: number;
  absentDays: Record<string, number>;
  absentDaysTotal: number;
}

export interface MonthSummary {
  month: string;
  until: string | null;
  people: MonthPerson[];
}

/** The week that holds `start` (any day of it); today's when none is given. */
export function usePlanningWeek(start?: string) {
  return useQuery({
    queryKey: ['planning', 'week', start ?? 'current'],
    queryFn: async () => {
      const res = await apiClient.get<PlanningWeek>(`/planning/week${start ? `?start=${start}` : ''}`);
      if (!res.success) throw apiError(res.error, 'Failed to load the planning');
      return res.data as PlanningWeek;
    },
  });
}

export function useAbsences(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['planning', 'absences', from, to],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<Absence[]>(`/planning/absences?from=${from}&to=${to}`);
      if (!res.success) throw apiError(res.error, 'Failed to load the absences');
      return res.data as Absence[];
    },
  });
}

export function usePlanningSummary(month: string, userId?: string, enabled = true) {
  return useQuery({
    queryKey: ['planning', 'summary', month, userId ?? 'all'],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<MonthSummary>(`/planning/summary?month=${month}${userId ? `&userId=${userId}` : ''}`);
      if (!res.success) throw apiError(res.error, 'Failed to load the hours');
      return res.data as MonthSummary;
    },
  });
}

function usePlanningMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning'] });
    },
  });
}

export function useSetShifts() {
  return usePlanningMutation(async ({ userId, shifts }: { userId: string; shifts: Shift[] }) => {
    const res = await apiClient.put(`/planning/shifts/${userId}`, { shifts });
    if (!res.success) throw apiError(res.error, 'Failed to save the usual week');
  });
}

export interface AbsenceInput {
  id?: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: AbsenceReason;
  note: string | null;
}

export function useSaveAbsence() {
  return usePlanningMutation(async ({ id, userId, ...fields }: AbsenceInput) => {
    const res = id ? await apiClient.put(`/planning/absences/${id}`, fields) : await apiClient.post('/planning/absences', { userId, ...fields });
    if (!res.success) throw apiError(res.error, 'Failed to save the absence');
  });
}

export function useDeleteAbsence() {
  return usePlanningMutation(async (id: string) => {
    const res = await apiClient.delete(`/planning/absences/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to delete the absence');
  });
}

// ─── Days and hours ──────────────────────────────────────────────────────────

const DAY_MS = 86400000;
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

export function addDays(day: string, n: number): string {
  return new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(day: string): number {
  return new Date(utc(day)).getUTCDay();
}

export function daysCount(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS) + 1;
}

/** "YYYY-MM" moved by `n` months. */
export function addMonths(month: string, n: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** First and last day of a month. */
export function monthBounds(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  return [new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10), new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)];
}

const locale = (language: string) => (language.startsWith('ar') ? 'ar-DZ-u-nu-latn' : 'fr-FR');

/** "dim. 11", "الأحد 11". */
export function dayLabel(day: string, language: string, weekday: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale(language), { weekday, day: 'numeric', timeZone: 'UTC' }).format(new Date(utc(day)));
}

/** "dimanche", "الأحد" for a weekday number. */
export function weekdayName(weekday: number, language: string): string {
  // 2024-01-07 is a Sunday.
  return new Intl.DateTimeFormat(locale(language), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + weekday)));
}

/** "11 – 17 octobre 2026". */
export function weekLabel(start: string, language: string): string {
  const end = addDays(start, 6);
  const fmt = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(language), { ...options, timeZone: 'UTC' }).format(new Date(utc(day)));
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })} – ${fmt(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** "octobre 2026". */
export function monthLabel(month: string, language: string): string {
  return new Intl.DateTimeFormat(locale(language), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(utc(`${month}-01`)));
}

/** "152 h", "7 h 30". */
export function hoursLabel(minutes: number, language: string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unit = language.startsWith('ar') ? 'سا' : 'h';
  return m === 0 ? `${h} ${unit}` : `${h} ${unit} ${String(m).padStart(2, '0')}`;
}
