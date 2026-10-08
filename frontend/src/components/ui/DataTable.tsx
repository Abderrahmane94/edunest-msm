import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { SearchInput } from './SearchInput';
import { useTranslation } from 'react-i18next';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /**
   * On a phone each row is a card: this column is its heading ('title'; the
   * first column by default), left out ('hidden'), or a labelled line.
   * Columns without a header (row actions) go to the card's top corner.
   */
  mobile?: 'title' | 'hidden' | 'line';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  searchable = false,
  searchPlaceholder,
  onSearch,
  sortColumn,
  sortDirection,
  onSort,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  className,
  emptyMessage,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const totalPages = total ? Math.ceil(total / pageSize) : 1;

  function handleSort(columnKey: string) {
    if (!onSort) return;
    const newDirection =
      sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  }

  function getSortIcon(columnKey: string) {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="w-4 h-4 text-text-disabled" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  }

  const cell = (col: Column<T>, row: T) =>
    col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode);

  // On a phone: a card per row (heading, row actions in the corner, then labelled lines).
  const titleColumn = columns.find((c) => c.mobile === 'title') ?? columns.find((c) => c.mobile !== 'hidden') ?? columns[0];
  const actionColumns = columns.filter((c) => c !== titleColumn && !c.header && c.mobile !== 'hidden');
  const lineColumns = columns.filter((c) => c !== titleColumn && !actionColumns.includes(c) && c.mobile !== 'hidden');

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {searchable && onSearch && (
        <SearchInput onSearch={onSearch} placeholder={searchPlaceholder} className="max-w-xs" />
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {data.length === 0 ? (
          <EmptyState bare message={emptyMessage ?? t('common.noData')} />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-hover border-b border-border">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-4 py-[10px] text-start text-caption font-medium text-text-secondary uppercase tracking-wider',
                          col.sortable && 'cursor-pointer select-none hover:text-text-primary',
                          col.className
                        )}
                        onClick={col.sortable ? () => handleSort(col.key) : undefined}
                        aria-sort={
                          sortColumn === col.key
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.header}
                          {col.sortable && getSortIcon(col.key)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr
                      key={keyExtractor(row)}
                      className={cn(
                        'border-b border-subtle last:border-b-0 hover:bg-hover transition-colors duration-150',
                        onRowClick && 'cursor-pointer'
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-4 py-3 text-body text-foreground', col.className)}>
                          {cell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-border">
              {data.map((row) => (
                <li
                  key={keyExtractor(row)}
                  className={cn('px-4 py-3', onRowClick && 'cursor-pointer active:bg-hover')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 text-body font-medium text-text-heading">{cell(titleColumn, row)}</div>
                    {actionColumns.map((col) => (
                      <div key={col.key} className="shrink-0 -my-1 -me-2">
                        {cell(col, row)}
                      </div>
                    ))}
                  </div>
                  {lineColumns.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                      {lineColumns.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <dt className="text-micro font-medium uppercase tracking-wide text-text-secondary truncate">
                            {col.header}
                          </dt>
                          <dd className="mt-0.5 text-caption text-foreground break-words">{cell(col, row)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {total != null && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-caption text-text-secondary">
              {t('table.pagination', { page, totalPages, total })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1}
                aria-label={t('table.prevPage')}
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages}
                aria-label={t('table.nextPage')}
              >
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
