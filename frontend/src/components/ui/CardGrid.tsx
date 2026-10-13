import * as React from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export type ListView = 'cards' | 'table';

/**
 * Whether a list shows as cards or as a table. Cards read better on a phone,
 * a table on a wide screen; the choice is kept, list by list (`name`).
 */
export function useListView(name: string): [ListView, (view: ListView) => void] {
  const key = `${name}_view`;
  const [view, setView] = React.useState<ListView>(() => {
    try {
      const kept = localStorage.getItem(key);
      if (kept === 'cards' || kept === 'table') return kept;
    } catch {
      // Private window: the default is used.
    }
    return window.innerWidth < 768 ? 'cards' : 'table';
  });
  const choose = React.useCallback(
    (next: ListView) => {
      setView(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Not kept: nothing else to do.
      }
    },
    [key],
  );
  return [view, choose];
}

/** The two buttons that switch a list between cards and table. */
export function ViewToggle({ view, onChange, className }: { view: ListView; onChange: (view: ListView) => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('listView.label')} className={cn('inline-flex shrink-0 rounded-full border border-border bg-card p-0.5', className)}>
      {(['cards', 'table'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          aria-label={t(`listView.${v}`)}
          title={t(`listView.${v}`)}
          onClick={() => onChange(v)}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring',
            view === v ? 'bg-primary text-white' : 'text-text-secondary hover:bg-subtle',
          )}
        >
          {v === 'cards' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
        </button>
      ))}
    </div>
  );
}

export interface CardGridProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** The card's content. */
  render: (item: T) => React.ReactNode;
  /** A tap on the card (its content becomes one button). */
  onOpen?: (item: T) => void;
  /** Under the content, outside the tap area: the card's own buttons. */
  footer?: (item: T) => React.ReactNode;
  emptyMessage: string;
  /** Paged lists: the same pager as under a table. */
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/** A list as cards: one, two or three across with the width of the screen. */
export function CardGrid<T>({ items, keyOf, render, onOpen, footer, emptyMessage, page = 1, pageSize = 10, total, onPageChange, className }: CardGridProps<T>) {
  const { t } = useTranslation();
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return (
    <>
      <ul className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3', className)}>
        {items.map((item) => {
          const actions = footer?.(item);
          return (
            <li key={keyOf(item)} className="flex flex-col bg-card border border-border rounded-xl transition-shadow hover:shadow-level-2 tabular-nums">
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex-1 w-full text-start p-4 space-y-3 rounded-xl focus-visible:outline-none focus-visible:shadow-focus-ring"
                >
                  {render(item)}
                </button>
              ) : (
                <div className="flex-1 p-4 space-y-3">{render(item)}</div>
              )}
              {actions && <div className="flex flex-wrap items-center justify-end gap-1 px-3 pb-3">{actions}</div>}
            </li>
          );
        })}
      </ul>
      {total != null && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-caption text-text-secondary">{t('table.pagination', { page, totalPages, total })}</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1} aria-label={t('table.prevPage')}>
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages} aria-label={t('table.nextPage')}>
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
