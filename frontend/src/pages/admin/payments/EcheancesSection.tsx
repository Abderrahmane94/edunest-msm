import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Ban } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { BillingPeriod } from '@/hooks/useEnrollments';

/** How an échéance reads at a glance. */
type Category = 'late' | 'due' | 'upcoming' | 'paid' | 'cancelled';

const DAY_MS = 86_400_000;

function startOfDay(value: string | Date): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * late:     past its grace period and not fully paid
 * due:      its due date has come, not fully paid (still within grace)
 * upcoming: not due yet
 */
function categoryOf(period: BillingPeriod, today: number): Category {
  if (period.cancelledAt) return 'cancelled';
  if (period.status === 'paid') return 'paid';
  if (period.status === 'late' || period.status === 'late_partial') return 'late';
  return startOfDay(period.dueDate) <= today ? 'due' : 'upcoming';
}

const CATEGORY_STYLE: Record<Category, { pill: string; bar: string; icon: React.ElementType }> = {
  late: { pill: 'bg-danger text-white', bar: 'bg-danger', icon: AlertTriangle },
  due: { pill: 'bg-danger-muted text-danger', bar: 'bg-danger/60', icon: AlertCircle },
  upcoming: { pill: 'border border-success/40 text-success', bar: 'bg-success/40', icon: Clock },
  paid: { pill: 'bg-success-muted text-success', bar: 'bg-success', icon: CheckCircle2 },
  cancelled: { pill: 'bg-subtle text-text-disabled', bar: 'bg-border', icon: Ban },
};

const FILTERS: Array<'all' | Category> = ['all', 'late', 'due', 'upcoming', 'paid', 'cancelled'];

/**
 * The child's échéances: a summary of what's owed, filter chips, and one row
 * per échéance coloured by where it stands (late / to pay / upcoming / paid).
 */
export function EcheancesSection({
  periods,
  getLabel,
}: {
  periods: BillingPeriod[];
  /** "Fee — month" label for a period. */
  getLabel: (period: BillingPeriod) => string;
}) {
  const { t, i18n } = useTranslation();
  const money = (v: string | number) => formatDZD(Number(v), i18n.language);
  const today = startOfDay(new Date());
  const [filter, setFilter] = React.useState<'all' | Category>('all');

  const rows = periods.map((period) => ({ period, category: categoryOf(period, today) }));
  const active = rows.filter((r) => r.category !== 'cancelled');
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  const total = active.reduce((sum, r) => sum + Number(r.period.amountDue), 0);
  const paid = active.reduce((sum, r) => sum + Number(r.period.totalPaid ?? 0), 0);
  const remaining = active.reduce((sum, r) => sum + Math.max(0, Number(r.period.outstanding ?? r.period.amountDue)), 0);
  const overdue = active
    .filter((r) => r.category === 'late' || r.category === 'due')
    .reduce((sum, r) => sum + Math.max(0, Number(r.period.outstanding ?? r.period.amountDue)), 0);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.category === filter);

  function relativeDue(dueDate: string): string {
    const days = Math.round((startOfDay(dueDate) - today) / DAY_MS);
    if (days === 0) return t('payments.enrollmentDetail.periods.today');
    return days > 0
      ? t('payments.enrollmentDetail.periods.inDays', { count: days })
      : t('payments.enrollmentDetail.periods.daysAgo', { count: -days });
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border space-y-4">
        <div>
          <h2 className="text-section-title font-semibold text-text-heading">
            {t('payments.enrollmentDetail.periods.title')}
          </h2>
          <p className="text-caption text-text-secondary mt-1">
            {t('payments.enrollmentDetail.periods.description', { count: active.length })}
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label={t('payments.enrollmentDetail.periods.summary.total')} value={money(total)} />
          <SummaryTile label={t('payments.enrollmentDetail.periods.summary.paid')} value={money(paid)} tone="success" />
          <SummaryTile label={t('payments.enrollmentDetail.periods.summary.remaining')} value={money(remaining)} />
          <SummaryTile
            label={t('payments.enrollmentDetail.periods.summary.overdue')}
            value={money(overdue)}
            tone={overdue > 0 ? 'danger' : undefined}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.filter((f) => f === 'all' || (counts[f] ?? 0) > 0).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium border transition-colors',
                filter === f
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-text-secondary border-border hover:bg-hover',
              )}
            >
              {t(`payments.enrollmentDetail.periods.filters.${f}`)}
              <span className={cn('rounded-full px-1.5 text-micro', filter === f ? 'bg-white/20' : 'bg-subtle')}>
                {f === 'all' ? rows.length : counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-body text-text-secondary">
            {rows.length === 0
              ? t('payments.enrollmentDetail.periods.empty')
              : t('payments.enrollmentDetail.periods.noMatch')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-subtle">
                <th className="w-1 p-0" />
                {(['period', 'dueDate', 'amountDue', 'remaining', 'status'] as const).map((col) => (
                  <th
                    key={col}
                    className={cn(
                      'px-4 py-3 text-caption font-medium text-text-secondary',
                      col === 'amountDue' || col === 'remaining' ? 'text-end' : 'text-start',
                    )}
                  >
                    {t(`payments.enrollmentDetail.periods.columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ period, category }) => {
                const style = CATEGORY_STYLE[category];
                const Icon = style.icon;
                const cancelled = category === 'cancelled';
                const partlyPaid = !cancelled && category !== 'paid' && Number(period.totalPaid ?? 0) > 0;
                const outstanding = Math.max(0, Number(period.outstanding ?? period.amountDue));
                return (
                  <tr
                    key={period.id}
                    className={cn('border-b border-border last:border-b-0', cancelled ? 'opacity-60' : 'hover:bg-hover')}
                  >
                    {/* Colour bar */}
                    <td className="w-1 p-0">
                      <div className={cn('w-1 h-full min-h-[56px]', style.bar)} />
                    </td>
                    <td className="px-4 py-3">
                      <p className={cn('text-body font-medium', cancelled ? 'line-through text-text-disabled' : 'text-foreground')}>
                        {getLabel(period)}
                      </p>
                      <p className="text-caption text-text-secondary" dir="ltr">
                        {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-body text-foreground" dir="ltr">
                        {formatDate(period.dueDate)}
                      </p>
                      {(category === 'due' || category === 'late' || category === 'upcoming') && (
                        <p
                          className={cn(
                            'text-caption',
                            category === 'upcoming' ? 'text-text-secondary' : 'text-danger font-medium',
                          )}
                        >
                          {relativeDue(period.dueDate)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <p
                        className={cn('text-body font-medium', cancelled ? 'line-through text-text-disabled' : 'text-foreground')}
                        dir="ltr"
                      >
                        {money(period.amountDue)}
                      </p>
                      {partlyPaid && (
                        <p className="text-caption text-success" dir="ltr">
                          {t('payments.enrollmentDetail.periods.paidPart', { amount: money(period.totalPaid ?? 0) })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <span
                        className={cn(
                          'text-body font-semibold',
                          cancelled || outstanding === 0
                            ? 'text-text-disabled'
                            : category === 'late' || category === 'due'
                              ? 'text-danger'
                              : 'text-foreground',
                        )}
                        dir="ltr"
                      >
                        {cancelled || outstanding === 0 ? '—' : money(outstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium whitespace-nowrap',
                          style.pill,
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {t(`payments.enrollmentDetail.periods.status.${category}`)}
                        {partlyPaid && ` · ${t('payments.enrollmentDetail.periods.status.partial')}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        tone === 'danger' ? 'bg-danger-muted' : tone === 'success' ? 'bg-success-muted' : 'bg-subtle',
      )}
    >
      <p className="text-caption text-text-secondary">{label}</p>
      <p
        className={cn(
          'text-subsection font-semibold mt-0.5',
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-foreground',
        )}
        dir="ltr"
      >
        {value}
      </p>
    </div>
  );
}
