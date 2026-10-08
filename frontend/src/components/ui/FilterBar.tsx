import * as React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { SearchInput, type SearchInputProps } from './SearchInput';

export interface FilterBarProps {
  /** A search field at the start of the bar. */
  search?: Pick<SearchInputProps, 'onSearch' | 'placeholder' | 'defaultValue'>;
  /** The filter fields (selects, dates…), laid out in a grid. */
  children?: React.ReactNode;
  /** How many filters differ from their default: shown on the phone's "Filters" button. */
  activeCount?: number;
  /** A line under the filters, e.g. "12 children". */
  summary?: React.ReactNode;
  /** Shown when filters are active: puts them back to their defaults. */
  onReset?: () => void;
  /** Columns of the field grid on large screens. */
  columns?: 2 | 3 | 4;
  className?: string;
}

const GRID: Record<NonNullable<FilterBarProps['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * Search and filters above a list, the same on every page. On a phone the
 * fields fold behind a "Filters" button so the list stays in view.
 */
export function FilterBar({
  search,
  children,
  activeCount = 0,
  summary,
  onReset,
  columns = 4,
  className,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const hasFields = React.Children.toArray(children).some(Boolean);

  return (
    <div className={cn('bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3', className)}>
      {(search || hasFields) && (
        <div className="flex items-center gap-2">
          {search && <SearchInput {...search} className="flex-1 min-w-0 sm:max-w-sm" />}
          {hasFields && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn('sm:hidden shrink-0', !search && 'w-full')}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t('common.filters')}
              {activeCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-accent)] text-white text-micro font-semibold flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </Button>
          )}
        </div>
      )}

      {hasFields && (
        // FormSelect / FormField carry their own bottom margin for forms: not in a filter row.
        <div className={cn('grid grid-cols-1 gap-3 [&>*]:!mb-0', GRID[columns], !open && 'hidden sm:grid')}>
          {children}
        </div>
      )}

      {(summary || (onReset && activeCount > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-[28px]">
          <p className="text-caption text-text-secondary">{summary}</p>
          {onReset && activeCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <X className="w-4 h-4" />
              {t('common.resetFilters')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
