import * as React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useClassrooms } from '@/hooks/useClassrooms';

/** The palette a class's color is taken from (the same names as on the server). */
export const CLASS_COLORS = ['violet', 'sky', 'teal', 'green', 'sun', 'orange', 'pink', 'red'] as const;
export type ClassColor = (typeof CLASS_COLORS)[number];

// Written out in full for Tailwind.
const LOOK: Record<ClassColor, { dot: string; soft: string }> = {
  violet: { dot: 'bg-[var(--color-accent)]', soft: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]' },
  sky: { dot: 'bg-[var(--color-sky)]', soft: 'bg-[var(--color-sky-muted)] text-[var(--color-sky)]' },
  teal: { dot: 'bg-[var(--color-teal)]', soft: 'bg-[var(--color-teal-muted)] text-[var(--color-teal)]' },
  green: { dot: 'bg-[var(--color-success)]', soft: 'bg-[var(--color-success-muted)] text-[var(--color-success)]' },
  sun: { dot: 'bg-[var(--color-sun)]', soft: 'bg-[var(--color-sun-muted)] text-[#B97800]' },
  orange: { dot: 'bg-[var(--color-warning)]', soft: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]' },
  pink: { dot: 'bg-[var(--color-pink)]', soft: 'bg-[var(--color-pink-muted)] text-[var(--color-pink)]' },
  red: { dot: 'bg-[var(--color-danger)]', soft: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]' },
};

/** The color chosen for a class, or one picked from its id so it never changes. */
export function classColor(id: string | undefined, chosen?: string | null): ClassColor {
  if (chosen && (CLASS_COLORS as readonly string[]).includes(chosen)) return chosen as ClassColor;
  let hash = 0;
  for (const ch of id ?? '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CLASS_COLORS[hash % CLASS_COLORS.length];
}

export const classDot = (color: ClassColor) => LOOK[color].dot;

/** Looks up the color of any class of the year by its id. */
export function useClassColor(): (classroomId: string | undefined) => ClassColor {
  const { data: classrooms } = useClassrooms();
  return React.useMemo(() => {
    const chosen = new Map((classrooms ?? []).map((c) => [c.id, c.color]));
    return (id) => classColor(id, id ? chosen.get(id) : null);
  }, [classrooms]);
}

/** A class's name on its color: the class is recognized before its name is read. */
export function ClassTag({ id, name, color, className }: { id?: string; name: string; color?: ClassColor; className?: string }) {
  const lookup = useClassColor();
  const look = LOOK[color ?? lookup(id)];
  return (
    <span className={cn('inline-flex items-center gap-1.5 max-w-full rounded-full px-2 py-0.5 text-caption font-medium', look.soft, className)}>
      <span className={cn('w-2 h-2 shrink-0 rounded-full', look.dot)} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The class form's color choice. `null`: left to the app. */
export function ClassColorPicker({ value, onChange, disabled }: { value: ClassColor | null; onChange: (color: ClassColor | null) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t('classrooms.form.color')} className="flex flex-wrap gap-2">
      {CLASS_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t(`classrooms.colors.${c}`)}
          title={t(`classrooms.colors.${c}`)}
          disabled={disabled}
          // A second tap gives the choice back to the app.
          onClick={() => onChange(value === c ? null : c)}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform focus-visible:outline-none focus-visible:shadow-focus-ring disabled:opacity-50',
            LOOK[c].dot,
            value === c ? 'ring-2 ring-offset-2 ring-[var(--color-accent)] scale-105' : 'hover:scale-105',
          )}
        >
          {value === c && <Check className="w-4 h-4" />}
        </button>
      ))}
    </div>
  );
}
