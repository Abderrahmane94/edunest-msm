import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** A count next to the label (e.g. unread items). */
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Labels the tab list for screen readers. */
  label?: string;
  className?: string;
}

/**
 * The page's sections, the same on every page. On a phone the tabs scroll
 * sideways instead of wrapping onto several lines.
 */
export function Tabs<T extends string>({ items, value, onChange, label, className }: TabsProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const activeIndex = items.findIndex((item) => item.value === value);

  // On a phone the active tab may sit past the edge of the row: scroll the row
  // (not the page) until it shows, e.g. when a link opens the last tab.
  React.useEffect(() => {
    const list = listRef.current;
    const tab = refs.current[activeIndex];
    if (!list || !tab) return;
    const l = list.getBoundingClientRect();
    const r = tab.getBoundingClientRect();
    if (r.left < l.left) list.scrollLeft -= l.left - r.left + 16;
    else if (r.right > l.right) list.scrollLeft += r.right - l.right + 16;
  }, [activeIndex]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const dir = document.documentElement.dir === 'rtl' ? -1 : 1;
    const step = e.key === 'ArrowRight' ? dir : e.key === 'ArrowLeft' ? -dir : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].value);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2.5 -mb-px border-b-2 whitespace-nowrap text-label font-medium transition-colors',
              'focus-visible:outline-none focus-visible:bg-hover rounded-t-md',
              active
                ? 'border-[var(--color-accent)] text-primary'
                : 'border-transparent text-text-secondary hover:text-text-heading hover:border-border',
            )}
          >
            {item.icon && <span className="[&>svg]:w-4 [&>svg]:h-4">{item.icon}</span>}
            {item.label}
            {item.count != null && item.count > 0 && (
              <span
                className={cn(
                  'min-w-[20px] h-5 px-1.5 rounded-full text-micro font-semibold flex items-center justify-center',
                  active ? 'bg-accent-muted text-primary' : 'bg-subtle text-text-secondary',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
