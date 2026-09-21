import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Algerian French-derived month names are the everyday convention for Arabic
// in this app's audience (matches the DZD/Western-digit choices already made
// in lib/formatters.ts), not the Mashriqi Gregorian names.
const MONTHS: Record<'fr' | 'ar', string[]> = {
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

const WEEKDAYS: Record<'fr' | 'ar', string[]> = {
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  ar: ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
};

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses a 'YYYY-MM-DD' string as a local-time Date (avoids UTC-midnight/timezone shift). */
function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** Builds a 6-week (42-day) grid starting on the Sunday on/before the 1st of the month. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - firstWeekday + i));
}

function formatDisplay(value: string): string {
  const date = parseISODate(value);
  if (!date) return value;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

export interface DatePickerInputProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

/**
 * Custom calendar date picker replacing the native `<input type="date">` —
 * consistent look across browsers/locales, matches the app's design system.
 * Mimics a native input's onChange contract ({target: {name, value}}) so it
 * drops into existing handlers unchanged.
 */
export function DatePickerInput({
  id,
  name,
  value = '',
  onChange,
  min,
  max,
  disabled,
  placeholder,
  className,
  ...aria
}: DatePickerInputProps) {
  const { t, i18n } = useTranslation();
  const lang: 'fr' | 'ar' = i18n.language === 'ar' ? 'ar' : 'fr';

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selected = parseISODate(value);
  const [viewDate, setViewDate] = React.useState(() => selected ?? new Date());

  React.useEffect(() => {
    if (selected) setViewDate(selected);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function emitChange(dateStr: string) {
    const fakeEvent = { target: { name, value: dateStr } } as unknown as React.ChangeEvent<HTMLInputElement>;
    onChange?.(fakeEvent);
  }

  function isDisabledDate(date: Date): boolean {
    const iso = toISODate(date);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function selectDay(date: Date) {
    if (isDisabledDate(date)) return;
    emitChange(toISODate(date));
    setOpen(false);
  }

  const monthGrid = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth());
  const todayIso = toISODate(new Date());

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-card border border-border rounded-md px-3 py-2 text-body text-start',
          'transition-all duration-150',
          'focus:outline-none focus:border-primary focus:shadow-focus-ring',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...aria}
      >
        <span className={value ? 'text-foreground' : 'text-text-disabled'}>
          {value ? formatDisplay(value) : (placeholder ?? t('common.datePicker.selectDate'))}
        </span>
        <Calendar className="w-4 h-4 text-text-secondary shrink-0" />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute z-50 mt-1 bg-card border border-border rounded-lg shadow-lg p-3 w-[280px] start-0"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate((d) => addMonths(d, -1))}
              className="p-1 rounded hover:bg-hover text-text-secondary"
              aria-label={t('common.datePicker.previousMonth')}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
            <span className="text-label font-medium text-foreground">
              {MONTHS[lang][viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              className="p-1 rounded hover:bg-hover text-text-secondary"
              aria-label={t('common.datePicker.nextMonth')}
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS[lang].map((w, i) => (
              <div key={i} className="text-center text-caption text-text-secondary font-medium py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid.map((date) => {
              const iso = toISODate(date);
              const inCurrentMonth = date.getMonth() === viewDate.getMonth();
              const isSelected = value === iso;
              const isToday = iso === todayIso;
              const dayDisabled = isDisabledDate(date);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => selectDay(date)}
                  className={cn(
                    'h-8 w-8 rounded-md text-caption flex items-center justify-center transition-colors',
                    inCurrentMonth ? 'text-foreground' : 'text-text-disabled',
                    isToday && !isSelected && 'border border-primary',
                    isSelected && 'bg-primary text-white',
                    !isSelected && !dayDisabled && 'hover:bg-hover',
                    dayDisabled && 'opacity-30 cursor-not-allowed',
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => selectDay(new Date())}
              className="text-caption text-primary hover:underline"
            >
              {t('common.datePicker.today')}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { emitChange(''); setOpen(false); }}
                className="text-caption text-text-secondary hover:underline"
              >
                {t('common.datePicker.clear')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
