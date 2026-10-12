import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  addDays,
  addMonths,
  dateInMonth,
  formatLongDate,
  formatMonth,
  localToday,
  localeTag,
  monthOf,
  type PeriodView,
} from '@/lib/period';

/** Day / month navigation shared by the parent's reports and attendance pages. */

const arrowClass =
  'grid place-items-center w-10 h-10 rounded-lg text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-150 disabled:text-text-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed';

/** "Jour | Mois" switch. */
export function ViewToggle({ value, onChange }: { value: PeriodView; onChange: (v: PeriodView) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('period.view')} className="inline-flex p-1 rounded-xl bg-subtle">
      {(['day', 'month'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            'min-h-[36px] px-4 rounded-lg text-caption font-medium transition-colors duration-150',
            value === v ? 'bg-card text-text-heading shadow-sm' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {t(`period.${v}`)}
        </button>
      ))}
    </div>
  );
}

/** ‹ day › with a date picker; never after today. */
export function DayNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const { t, i18n } = useTranslation();
  const today = localToday();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isToday = date === today;

  return (
    <div className="flex items-center justify-between gap-2 bg-card border border-border rounded-xl px-2 py-2">
      <button type="button" onClick={() => onChange(addDays(date, -1))} className={arrowClass} aria-label={t('period.previousDay')}>
        <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
      </button>

      <label className="relative flex-1 min-w-0 flex flex-col items-center cursor-pointer">
        <span className="flex items-center gap-2 text-body font-semibold text-text-heading capitalize text-center">
          <CalendarDays className="w-4 h-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
          <span className="truncate">{isToday ? t('period.today') : formatLongDate(date, i18n.language)}</span>
        </span>
        {isToday && (
          <span className="text-micro text-text-secondary capitalize">{formatLongDate(date, i18n.language)}</span>
        )}
        {/* The native picker, over the label: tapping the date opens it. */}
        <input
          ref={inputRef}
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label={t('period.pickDate')}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange(addDays(date, 1))}
        disabled={isToday}
        className={arrowClass}
        aria-label={t('period.nextDay')}
      >
        <ChevronRight className="w-5 h-5 rtl:rotate-180" />
      </button>
    </div>
  );
}

/** ‹ month › ; never after the current month. */
export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const { t, i18n } = useTranslation();
  const current = monthOf(localToday());
  return (
    <div className="flex items-center justify-between gap-2 bg-card border border-border rounded-xl px-2 py-2">
      <button type="button" onClick={() => onChange(addMonths(month, -1))} className={arrowClass} aria-label={t('period.previousMonth')}>
        <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
      </button>
      <span className="flex items-center gap-2 text-body font-semibold text-text-heading capitalize">
        <CalendarDays className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
        {formatMonth(month, i18n.language)}
      </span>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={month >= current}
        className={arrowClass}
        aria-label={t('period.nextMonth')}
      >
        <ChevronRight className="w-5 h-5 rtl:rotate-180" />
      </button>
    </div>
  );
}

/** "All | Yasmine | Ahmed": one child or all of them (null = all). */
export function ChildChips({
  items,
  value,
  onChange,
  allLabel,
}: {
  items: Array<{ id: string; name: string }>;
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel: string;
}) {
  const chips = [{ id: null as string | null, label: allLabel }, ...items.map((c) => ({ id: c.id, label: c.name.split(' ')[0] }))];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((c) => (
        <button
          key={c.id ?? 'all'}
          type="button"
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
          className={cn(
            'shrink-0 min-h-[36px] px-4 rounded-full border text-caption font-medium transition-colors duration-150',
            value === c.id
              ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
              : 'bg-card text-text-secondary border-border hover:bg-hover',
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A month as a calendar grid (weeks start on Sunday, as the school week does).
 * `renderDay` fills a day's cell; tapping a past or present day calls `onSelect`.
 */
export function MonthCalendar({
  month,
  renderDay,
  dayLabel,
  onSelect,
}: {
  month: string;
  renderDay: (date: string) => React.ReactNode;
  /** What a day holds, for screen readers. */
  dayLabel?: (date: string) => string;
  onSelect: (date: string) => void;
}) {
  const { i18n } = useTranslation();
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = localToday();

  // Sunday 7 January 2024 onwards gives the weekday names in order.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(localeTag(i18n.language), { weekday: 'narrow', timeZone: 'UTC' }),
  );

  const cells: Array<string | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => dateInMonth(month, i + 1)),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((w, i) => (
          <span key={i} className="text-center text-micro font-medium text-text-secondary">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) =>
          date === null ? (
            <span key={`empty-${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              disabled={date > today}
              aria-label={dayLabel ? `${formatLongDate(date, i18n.language)} — ${dayLabel(date)}` : formatLongDate(date, i18n.language)}
              className={cn(
                'relative aspect-square min-h-[40px] flex flex-col items-center justify-center rounded-lg text-caption transition-colors duration-150',
                'hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default',
                date === today && 'ring-2 ring-[var(--color-accent)] ring-inset',
              )}
            >
              <span className="text-micro text-text-secondary leading-none">{Number(date.slice(8))}</span>
              <span className="mt-0.5 leading-none">{renderDay(date)}</span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
