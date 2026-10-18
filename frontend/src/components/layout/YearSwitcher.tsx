import { useTranslation } from 'react-i18next';
import { CalendarRange, ChevronDown, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setSelectedYearId, useSelectedYear } from '@/hooks/useSelectedYear';
import { shortYearName } from '@/lib/yearName';

/** Picks the school year the admin screens show (top bar). */
export function YearSwitcher() {
  const { t } = useTranslation();
  const { year, years, activeYear, enabled } = useSelectedYear();
  if (!enabled || !year || years.length === 0) return null;
  const isActive = year.id === activeYear?.id;

  // What shows is our own text (short on a phone, in the Latin font even in
  // Arabic); the phone's own list sits invisible on top and opens on a tap.
  return (
    <label
      className={cn(
        'relative inline-flex items-center gap-1.5 h-9 ps-2.5 pe-7 rounded-full border text-caption font-semibold cursor-pointer transition-colors',
        "font-['Plus_Jakarta_Sans',system-ui,sans-serif] focus-within:shadow-focus-ring",
        isActive
          ? 'bg-[var(--color-accent-subtle)] border-accent-muted text-primary hover:bg-accent-muted'
          : 'bg-warning-muted border-warning text-warning',
      )}
      title={t('yearSwitcher.label')}
    >
      <CalendarRange className="w-4 h-4 shrink-0" />
      <span dir="ltr" aria-hidden="true" className="whitespace-nowrap leading-none">
        <span className="sm:hidden">{shortYearName(year.name)}</span>
        <span className="hidden sm:inline">
          {year.name}
          {isActive ? ` · ${t('yearSwitcher.current')}` : ''}
        </span>
      </span>
      <select
        value={year.id}
        onChange={(e) => setSelectedYearId(e.target.value === activeYear?.id ? null : e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label={t('yearSwitcher.label')}
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.is_active ? ` · ${t('yearSwitcher.current')}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute end-2.5 pointer-events-none" />
    </label>
  );
}

/** Says which year is shown when it isn't the current one, with a way back. */
export function YearBanner() {
  const { t } = useTranslation();
  const { year, activeYear, isActiveYear, isClosed, enabled } = useSelectedYear();
  if (!enabled || !year || isActiveYear) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-transparent bg-warning-muted px-4 py-2.5 text-body text-foreground"
    >
      <History className="w-4 h-4 text-warning shrink-0" />
      <span className="flex-1 min-w-[12rem]">
        {t(isClosed ? 'yearSwitcher.closedBanner' : 'yearSwitcher.banner', { name: `⁦${year.name}⁩` })}
      </span>
      {activeYear && (
        <button
          type="button"
          onClick={() => setSelectedYearId(null)}
          className="text-caption font-semibold text-primary hover:underline"
        >
          {t('yearSwitcher.back', { name: activeYear.name })}
        </button>
      )}
    </div>
  );
}
