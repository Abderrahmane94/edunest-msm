/**
 * Each menu entry gets its own color, taken in turn from the logo's palette,
 * so the menu reads at a glance. Classes are written out in full for Tailwind.
 */
const NAV_CHIPS = [
  'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  'bg-[var(--color-sky-muted)] text-[var(--color-sky)]',
  'bg-[var(--color-teal-muted)] text-[var(--color-teal)]',
  'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
  'bg-[var(--color-pink-muted)] text-[var(--color-pink)]',
  'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  'bg-[var(--color-sun-muted)] text-[#B97800]',
] as const;

export function navChip(index: number): string {
  return NAV_CHIPS[index % NAV_CHIPS.length];
}
