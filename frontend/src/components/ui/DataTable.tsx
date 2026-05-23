import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from './Button';
import { useTranslation } from 'react-i18next';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
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
  searchPlaceholder = 'Search...',
  onSearch,
  sortColumn,
  sortDirection,
  onSort,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  className,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const totalPages = total ? Math.ceil(total / pageSize) : 1;
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchQuery(value);

    // Debounce the onSearch callback to avoid firing on every keystroke
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearch?.(value);
    }, 350);
  }

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {searchable && (
        <div className="relative max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder={searchPlaceholder}
            className="w-full bg-card border border-border rounded-md ps-9 pe-3 py-2 text-body text-foreground placeholder:text-text-disabled focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
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
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-body text-text-secondary"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={keyExtractor(row)}
                    className={cn(
                      'border-b border-subtle last:border-b-0 hover:bg-hover transition-colors duration-150',
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn('px-4 py-3 text-body text-foreground', col.className)}
                      >
                        {col.render
                          ? col.render(row)
                          : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
