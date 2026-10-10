import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_FILL, TONE_ICON, TONE_TEXT, type Tone } from './theme';

/** Building blocks shared by the dashboards. */

// ─── Building blocks ───

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-label font-bold uppercase tracking-wide text-[var(--color-accent-hover)]">
        <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[var(--color-warning-light)] to-[var(--color-pink)]" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Tile({
  icon,
  tone = 'neutral',
  title,
  to,
  className,
  children,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  to?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? ChevronLeft : ChevronRight;
  const body = (
    <>
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', TONE_ICON[tone])}>{icon}</div>
        <p className="text-label font-medium text-text-secondary flex-1 min-w-0 truncate">{title}</p>
        {to && (
          <Chevron className="w-4 h-4 text-text-disabled shrink-0 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        )}
      </div>
      <div className="mt-3">{children}</div>
    </>
  );
  const base = 'group block bg-card border border-border rounded-lg shadow-level-1 p-4 sm:p-5';
  return to ? (
    <Link
      to={to}
      className={cn(
        base,
        'transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-0.5 hover:shadow-level-3 hover:border-[var(--color-accent-muted)] focus-visible:outline-none focus-visible:shadow-focus-ring',
        className,
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(base, className)}>{body}</div>
  );
}

export function BigNumber({ value, tone = 'neutral', suffix }: { value: string; tone?: Tone; suffix?: string }) {
  return (
    <p className="flex items-baseline gap-1.5 flex-wrap">
      <span className={cn('text-page-title font-bold leading-none', TONE_TEXT[tone])} dir="ltr">
        {value}
      </span>
      {suffix && <span className="text-caption text-text-secondary">{suffix}</span>}
    </p>
  );
}

export function Progress({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-2 bg-subtle rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE_FILL[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Vertical bars; a bar without a value (null) shows as an empty slot, a chart with nothing to show says so. */
export function BarChart({
  bars,
  tone,
  emptyLabel,
}: {
  bars: { key: string; label: string; value: number | null; display: string }[];
  tone: Tone;
  emptyLabel: string;
}) {
  const max = Math.max(0, ...bars.map((b) => b.value ?? 0));
  if (max === 0) {
    return (
      <div className="h-40 flex items-center justify-center rounded-lg bg-subtle text-caption text-text-secondary">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2 sm:gap-3 h-40" role="list">
      {bars.map((b, i) => {
        const height = b.value != null && max > 0 ? Math.max(4, (Math.max(0, b.value) / max) * 100) : 0;
        const last = i === bars.length - 1;
        return (
          <div key={b.key} role="listitem" className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5">
            {/* On a phone only the latest value shows: the others would overlap. */}
            <span
              className={cn('text-micro font-medium whitespace-nowrap', last ? 'text-text-heading' : 'text-text-secondary hidden sm:inline')}
              dir="ltr"
            >
              {b.value != null ? b.display : ''}
            </span>
            <div className="w-full flex-1 flex items-end">
              {b.value != null ? (
                <div
                  className={cn('w-full rounded-t-md transition-[height] duration-500', TONE_FILL[tone], !last && 'opacity-50')}
                  style={{ height: `${height}%` }}
                  title={`${b.label} : ${b.display}`}
                />
              ) : (
                <div className="w-full h-1 rounded bg-subtle" title={`${b.label} : ${emptyLabel}`} />
              )}
            </div>
            {/* Many bars on a phone: every other month is named, so the names fit. */}
            <span
              className={cn(
                'text-micro text-text-secondary truncate max-w-full',
                bars.length > 8 && i % 2 === 0 && !last && 'invisible sm:visible',
              )}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface ActionItem {
  key: string;
  tone: Tone;
  icon: React.ReactNode;
  text: string;
  to: string;
}

/** What needs doing, each line leading to its page; a reassuring line when there's nothing. */
export function ActionList({ title, allGood, items }: { title: string; allGood: string; items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 bg-[var(--color-success-subtle)] border border-[var(--color-success-muted)] rounded-lg px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <p className="text-body font-medium text-success">{allGood}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h2 className="text-label font-semibold text-text-heading">{title}</h2>
        <span className="ms-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-danger-muted text-danger text-micro font-semibold flex items-center justify-center">
          {items.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors focus-visible:outline-none focus-visible:bg-hover"
            >
              <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', TONE_ICON[item.tone])}>
                {item.icon}
              </span>
              <span className="text-body text-text-heading flex-1 min-w-0">{item.text}</span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChevronIcon() {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? ChevronLeft : ChevronRight;
  return <Chevron className="w-4 h-4 text-text-disabled shrink-0" />;
}
