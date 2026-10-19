import i18next from 'i18next';

const isArabic = (language?: string) => (language ?? i18next.language ?? '').startsWith('ar');

/**
 * A year name as shown: in Arabic the first year reads first, from the right
 * ("2027/2026" on screen for 2026/2027). Kept in order everywhere else, and
 * always stored in order. Isolated, so the sentence around it can't flip it.
 */
export function yearLabel(name: string, language?: string): string {
  const m = name.match(/^(.*?)(\d{4})(\s*\D{1,3}\s*)(\d{4})(.*)$/s);
  if (!m || !isArabic(language)) return name;
  const [, before, a, sep, b, after] = m;
  return `${before}⁦${b}${sep}${a}⁩${after}`;
}

/** "2026-2027" → "26-27" ("27-26" in Arabic), for the phone's narrow top bar. */
export function shortYearName(name: string, language?: string): string {
  const m = name.match(/(\d{4})\D+(\d{4})/);
  if (!m) return name;
  const [a, b] = [m[1].slice(2), m[2].slice(2)];
  return isArabic(language) ? `${b}-${a}` : `${a}-${b}`;
}

/** "2026-2027" from the two dates, once both are set. */
export function yearNameFromDates(start: string, end: string): string | null {
  const a = start.slice(0, 4);
  const b = end.slice(0, 4);
  if (!/^\d{4}$/.test(a) || !/^\d{4}$/.test(b)) return null;
  return a === b ? a : `${a}-${b}`;
}
