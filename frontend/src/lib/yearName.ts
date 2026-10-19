/** "2026-2027" → "26-27", for the phone's narrow top bar. */
export function shortYearName(name: string): string {
  const m = name.match(/(\d{4})\D+(\d{4})/);
  return m ? `${m[1].slice(2)}-${m[2].slice(2)}` : name;
}

/** "2026-2027" from the two dates, once both are set. */
export function yearNameFromDates(start: string, end: string): string | null {
  const a = start.slice(0, 4);
  const b = end.slice(0, 4);
  if (!/^\d{4}$/.test(a) || !/^\d{4}$/.test(b)) return null;
  return a === b ? a : `${a}-${b}`;
}
