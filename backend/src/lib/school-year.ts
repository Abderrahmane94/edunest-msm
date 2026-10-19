/**
 * The school year a day falls in: from September 1st to July 31st. From
 * August on, the coming year (a school created in August prepares September).
 */
export function schoolYearOf(day: string): { name: string; startDate: string; endDate: string } {
  const [year, month] = day.split('-').map(Number);
  const start = month >= 8 ? year : year - 1;
  return { name: `${start}-${start + 1}`, startDate: `${start}-09-01`, endDate: `${start + 1}-07-31` };
}

/**
 * A year name with its two years in order: "2027/2026", typed in a
 * right-to-left field, becomes "2026/2027". Anything else stays as written.
 */
export function orderedYearName(name: string): string {
  return name.replace(/(\d{4})(\s*\D{1,3}\s*)(\d{4})/, (whole, a: string, sep: string, b: string) =>
    Number(a) > Number(b) ? `${b}${sep}${a}` : whole,
  );
}
