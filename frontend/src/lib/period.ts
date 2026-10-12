/**
 * Day and month helpers for the parent's reports and attendance pages.
 * Dates are "YYYY-MM-DD" and months "YYYY-MM" strings, in the device's time
 * zone, so a day never shifts by one around midnight.
 */

export type PeriodView = 'day' | 'month';

const pad = (n: number) => String(n).padStart(2, '0');

/** Today on this device, "YYYY-MM-DD". */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** The given day of a month: ("2026-10", 3) → "2026-10-03". */
export function dateInMonth(month: string, day: number): string {
  return `${month}-${pad(day)}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, 1));
  return next.toISOString().slice(0, 7);
}

export const localeTag = (lang: string) => (lang === 'ar' ? 'ar-DZ' : 'fr-FR');

/** "lundi 12 octobre 2026" */
export function formatLongDate(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(localeTag(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "octobre 2026" */
export function formatMonth(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(localeTag(lang), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
