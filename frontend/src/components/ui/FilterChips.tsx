import { cn } from '@/lib/utils';

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  /** How many rows it keeps: read at a glance, before filtering. */
  count?: number;
  /** A colored dot before the label (a Tailwind background class). */
  dot?: string;
}

export interface FilterChipsProps<T extends string> {
  options: FilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the chips filter, for screen readers. */
  label: string;
  className?: string;
}

/**
 * One row of chips to filter a list: the choice and its count are read
 * together, without opening a dropdown. Scrolls sideways on a phone.
 */
export function FilterChips<T extends string>({ options, value, onChange, label, className }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('no-scrollbar flex gap-2 overflow-x-auto pb-1 -mx-1 px-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 min-h-[36px] rounded-full px-3 text-caption font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring',
              active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-text-secondary border-border hover:bg-hover',
            )}
          >
            {o.dot && <span className={cn('w-2 h-2 rounded-full', o.dot)} aria-hidden="true" />}
            {o.label}
            {o.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-micro tabular-nums', active ? 'bg-white/10' : 'bg-subtle')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
