/** "2026-2027" → "26-27", for the phone's narrow top bar. */
export function shortYearName(name: string): string {
  const m = name.match(/(\d{4})\D+(\d{4})/);
  return m ? `${m[1].slice(2)}-${m[2].slice(2)}` : name;
}
