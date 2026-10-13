import { useTranslation } from 'react-i18next';
import { Check, CloudOff, Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import type { Mood } from '@/hooks/useCommunication';

/** Where a child's report for today stands. */
export type ReportStatus = 'todo' | 'done' | 'pending';
export type ReportFilter = 'all' | 'todo' | 'done';

export interface ReportListChild {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
}

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😊',
  sad: '😢',
  tired: '😴',
  excited: '🤩',
  calm: '😌',
};

const FILTERS: ReportFilter[] = ['all', 'todo', 'done'];

/**
 * The classroom's children as a compact, searchable list showing whose report
 * is done today — usable with 30 children as well as 3.
 */
export function DailyReportChildList({
  children,
  statusOf,
  moodOf,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
}: {
  /** Already searched, filtered and sorted. */
  children: ReportListChild[];
  statusOf: (id: string) => ReportStatus;
  moodOf: (id: string) => Mood | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  filter: ReportFilter;
  onFilterChange: (f: ReportFilter) => void;
  counts: Record<ReportFilter, number>;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 lg:max-h-[calc(100dvh-12rem)]">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-text-disabled" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('dailyReport.list.search')}
          aria-label={t('dailyReport.list.search')}
          className="w-full min-h-[44px] ps-9 pe-3 rounded-lg border border-border bg-card text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary"
        />
      </div>

      <div role="group" aria-label={t('dailyReport.list.filterLabel')} className="flex gap-2">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onFilterChange(f)}
              aria-pressed={active}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 min-h-[36px] rounded-full px-3 text-caption font-medium border transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-text-secondary border-border hover:bg-hover',
              )}
            >
              {t(`dailyReport.list.filters.${f}`)}
              <span className={cn('rounded-full px-1.5 text-micro', active ? 'bg-white/10' : 'bg-subtle')}>
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {children.length === 0 ? (
        <p className="text-body text-text-secondary text-center py-8">{t('dailyReport.list.noMatch')}</p>
      ) : (
        <ul className="bg-card border border-border rounded-lg divide-y divide-border overflow-y-auto lg:min-h-0">
          {children.map((child) => {
            const status = statusOf(child.id);
            const mood = moodOf(child.id);
            const selected = child.id === selectedId;
            const name = `${child.first_name} ${child.last_name}`;
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onSelect(child.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 min-h-[56px] px-3 py-2 text-start transition-colors border-s-4',
                    selected ? 'bg-[var(--color-accent-muted)] border-s-[var(--color-accent)]' : 'border-s-transparent hover:bg-hover',
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar src={child.photo_url ?? undefined} name={name} size="sm" />
                    {status !== 'todo' && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute -bottom-1 -end-1 grid place-items-center w-4 h-4 rounded-full ring-2 ring-card text-[var(--color-text-inverse)]',
                          status === 'done' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]',
                        )}
                      >
                        {status === 'done' ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <CloudOff className="w-2.5 h-2.5" />}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium text-text-heading truncate">{name}</p>
                    <p
                      className={cn(
                        'text-micro font-medium',
                        status === 'done' && 'text-[var(--color-success)]',
                        status === 'pending' && 'text-[var(--color-warning)]',
                        status === 'todo' && 'text-text-secondary',
                      )}
                    >
                      {t(`dailyReport.list.status.${status}`)}
                    </p>
                  </div>
                  {mood && (
                    <span className="text-xl shrink-0" role="img" aria-label={t(`dailyReport.moods.${mood}`)}>
                      {MOOD_EMOJI[mood]}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-disabled shrink-0 rtl:rotate-180 lg:hidden" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
