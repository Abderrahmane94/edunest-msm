import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Ban, Percent } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { BillingPeriod } from '@/hooks/useEnrollments';
import type { Discount } from '@/hooks/useDiscounts';

/** How an échéance reads at a glance. */
type Category = 'late' | 'due' | 'upcoming' | 'paid' | 'cancelled';
type Filter = 'all' | Category | 'discounted';

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

const CATEGORY_STYLE: Record<Category, { pill: string; border: string; icon: React.ElementType }> = {
  late: { pill: 'bg-danger text-white', border: 'border-s-danger', icon: AlertTriangle },
  due: { pill: 'bg-danger-muted text-danger', border: 'border-s-danger/60', icon: AlertCircle },
  upcoming: { pill: 'border border-success/40 text-success', border: 'border-s-success/40', icon: Clock },
  paid: { pill: 'bg-success-muted text-success', border: 'border-s-success', icon: CheckCircle2 },
  cancelled: { pill: 'bg-subtle text-text-disabled', border: 'border-s-border', icon: Ban },
};

const FILTERS: Filter[] = ['all', 'late', 'due', 'upcoming', 'paid', 'discounted', 'cancelled'];

/**
 * The discounts behind a period's reduced amount: same rule as the server —
 * targeting its fee (or every recurring fee) and valid on its start date.
 */
function discountsFor(period: BillingPeriod, discounts: Discount[]): Discount[] {
  const start = startOfDay(period.periodStart);
  return discounts.filter(
    (d) =>
      (!d.branchFeeId || d.branchFeeId === period.branchFeeId) &&
      startOfDay(d.validFrom) <= start &&
      (!d.validTo || startOfDay(d.validTo) >= start),
  );
}

/** Column layout, shared by the header and the rows so they line up. */
const COLUMNS = [
  { key: 'period', width: 'w-[34%]', align: 'text-start' },
  { key: 'dueDate', width: 'w-[16%]', align: 'text-start' },
  { key: 'amountDue', width: 'w-[18%]', align: 'text-end' },
  { key: 'remaining', width: 'w-[14%]', align: 'text-end' },
  { key: 'status', width: 'w-[18%]', align: 'text-start' },
] as const;

/**
 * The child's échéances: a summary of what's owed, filter chips, and one row
 * per échéance coloured by where it stands (late / to pay / upcoming / paid),
 * with discounts shown on the amounts they reduce.
 */
export function EcheancesSection({
  periods,
  getLabel,
  discounts = [],
}: {
  periods: BillingPeriod[];
  /** "Fee — month" label for a period. */
  getLabel: (period: BillingPeriod) => string;
  /** The enrollment's discounts, to explain reduced amounts. */
  discounts?: Discount[];
}) {
  const { t, i18n } = useTranslation();
  const money = (v: string | number) => formatDZD(Number(v), i18n.language);
  const today = startOfDay(new Date());
  const [filter, setFilter] = React.useState<Filter>('all');

  /** "−10 %" or "−500,00 DA" for one discount. */
  const discountValue = (d: Discount) =>
    d.fixedAmount != null ? money(-Number(d.fixedAmount)) : `−${Number(d.percentage)} %`;

  const rows = periods.map((period) => {
    const base = Number(period.baseAmount ?? period.amountDue);
    const saved = Math.max(0, Math.round((base - Number(period.amountDue)) * 100) / 100);
    return {
      period,
      category: categoryOf(period, today),
      base,
      saved,
      applied: saved > 0 ? discountsFor(period, discounts) : [],
    };
  });
  const active = rows.filter((r) => r.category !== 'cancelled');
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    if (r.saved > 0 && r.category !== 'cancelled') acc.discounted = (acc.discounted ?? 0) + 1;
    return acc;
  }, {});

  const outstandingOf = (p: BillingPeriod) => Math.max(0, Number(p.outstanding ?? p.amountDue));
  const total = active.reduce((sum, r) => sum + Number(r.period.amountDue), 0);
  const paid = active.reduce((sum, r) => sum + Number(r.period.totalPaid ?? 0), 0);
  const remaining = active.reduce((sum, r) => sum + outstandingOf(r.period), 0);
  const overdue = active
    .filter((r) => r.category === 'late' || r.category === 'due')
    .reduce((sum, r) => sum + outstandingOf(r.period), 0);
  const totalSaved = active.reduce((sum, r) => sum + r.saved, 0);

  const visible =
    filter === 'all'
      ? rows
      : filter === 'discounted'
        ? rows.filter((r) => r.saved > 0 && r.category !== 'cancelled')
        : rows.filter((r) => r.category === filter);

  function relativeDue(dueDate: string): string {
    const days = Math.round((startOfDay(dueDate) - today) / DAY_MS);
    if (days === 0) return t('payments.enrollmentDetail.periods.today');
    return days > 0
      ? t('payments.enrollmentDetail.periods.inDays', { count: days })
      : t('payments.enrollmentDetail.periods.daysAgo', { count: -days });
  }

  /**
   * The line under the due date. A late échéance counts its days late from the
   * end of its grace period, like the late-payments dashboard, so both screens
   * give the same number.
   */
  function dueNote(period: BillingPeriod, category: Category): string {
    if (category !== 'late') return relativeDue(period.dueDate);
    const days = Math.max(0, Math.round((today - startOfDay(period.graceEndDate)) / DAY_MS));
    return t('payments.late.daysLate', { count: days });
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border space-y-4">
        <div>
          <h2 className="text-section font-semibold text-text-heading">
            {t('payments.enrollmentDetail.periods.title')}
          </h2>
          <p className="text-caption text-text-secondary mt-1">
            {t('payments.enrollmentDetail.periods.description', { count: active.length })}
          </p>
        </div>

        {/* Summary */}
        <div className={cn('grid grid-cols-2 gap-3', totalSaved > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
          <SummaryTile label={t('payments.enrollmentDetail.periods.summary.total')} value={money(total)} />
          <SummaryTile label={t('payments.enrollmentDetail.periods.summary.paid')} value={money(paid)} tone="success" />
          <SummaryTile label={t('payments.enrollmentDetail.periods.summary.remaining')} value={money(remaining)} />
          <SummaryTile
            label={t('payments.enrollmentDetail.periods.summary.overdue')}
            value={money(overdue)}
            tone={overdue > 0 ? 'danger' : undefined}
          />
          {totalSaved > 0 && (
            <SummaryTile
              label={t('payments.enrollmentDetail.periods.summary.discounts')}
              value={money(-totalSaved)}
              tone="discount"
            />
          )}
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
        <>
        {/* Phones: one card per échéance. */}
        <ul className="md:hidden divide-y divide-border">
          {visible.map(({ period, category, base, saved, applied }) => {
            const style = CATEGORY_STYLE[category];
            const Icon = style.icon;
            const cancelled = category === 'cancelled';
            const partlyPaid = !cancelled && category !== 'paid' && Number(period.totalPaid ?? 0) > 0;
            const outstanding = outstandingOf(period);
            const discounted = saved > 0 && !cancelled;
            return (
              <li key={period.id} className={cn('border-s-4 px-4 py-3 space-y-2', style.border, cancelled && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-body font-medium [overflow-wrap:anywhere]',
                        cancelled ? 'line-through text-text-disabled' : 'text-foreground',
                      )}
                    >
                      {getLabel(period)}
                    </p>
                    <p className="text-caption text-text-secondary tabular-nums">
                      <bdi>
                        {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
                      </bdi>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium whitespace-nowrap',
                      style.pill,
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {t(`payments.enrollmentDetail.periods.status.${category}`)}
                  </span>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  <div className="text-caption">
                    <p className="text-text-secondary">
                      {t('payments.enrollmentDetail.periods.columns.dueDate')}{' '}
                      <bdi dir="ltr" className="text-foreground tabular-nums">{formatDate(period.dueDate)}</bdi>
                    </p>
                    {(category === 'due' || category === 'late' || category === 'upcoming') && (
                      <p className={category === 'upcoming' ? 'text-text-secondary' : 'text-danger font-medium'}>
                        {dueNote(period, category)}
                      </p>
                    )}
                  </div>
                  <div className="text-end">
                    <p className="text-body tabular-nums whitespace-nowrap">
                      {discounted && (
                        <bdi dir="ltr" className="text-caption text-text-disabled line-through me-1.5">{money(base)}</bdi>
                      )}
                      <bdi dir="ltr" className={cn('font-medium', cancelled ? 'line-through text-text-disabled' : 'text-foreground')}>
                        {money(period.amountDue)}
                      </bdi>
                    </p>
                    {!cancelled && outstanding > 0 && (outstanding !== Number(period.amountDue) || partlyPaid) && (
                      <p
                        className={cn(
                          'text-caption font-semibold',
                          category === 'late' || category === 'due' ? 'text-danger' : 'text-foreground',
                        )}
                      >
                        {t('payments.enrollmentDetail.periods.columns.remaining')}{' '}
                        <bdi dir="ltr" className="tabular-nums">{money(outstanding)}</bdi>
                      </p>
                    )}
                  </div>
                </div>
                {(discounted || partlyPaid) && (
                  <div className="flex flex-wrap gap-2">
                    {discounted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary">
                        <Percent className="w-3 h-3" />
                        <bdi dir="ltr">
                          {applied.length === 1 ? discountValue(applied[0]) : money(-saved)}
                        </bdi>
                        {applied.length === 1 && ` ${t(`payments.enrollmentDetail.discounts.types.${applied[0].type}`)}`}
                      </span>
                    )}
                    {partlyPaid && (
                      <span className="text-micro text-success">
                        {t('payments.enrollmentDetail.periods.paidPart', { amount: money(period.totalPaid ?? 0) })}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Wider screens: the table. */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed">
            <colgroup>
              {COLUMNS.map((col) => (
                <col key={col.key} className={col.width} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-subtle">
                {COLUMNS.map((col, i) => (
                  <th
                    key={col.key}
                    className={cn(
                      'py-3 text-caption font-medium text-text-secondary',
                      col.align,
                      // Leave room for the coloured border of the first cell.
                      i === 0 ? 'ps-5 pe-4' : 'px-4',
                    )}
                  >
                    {t(`payments.enrollmentDetail.periods.columns.${col.key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ period, category, base, saved, applied }) => {
                const style = CATEGORY_STYLE[category];
                const Icon = style.icon;
                const cancelled = category === 'cancelled';
                const partlyPaid = !cancelled && category !== 'paid' && Number(period.totalPaid ?? 0) > 0;
                const outstanding = outstandingOf(period);
                const discounted = saved > 0 && !cancelled;
                return (
                  <tr
                    key={period.id}
                    className={cn(
                      'border-b border-border last:border-b-0 align-middle',
                      cancelled ? 'opacity-60' : 'hover:bg-hover',
                    )}
                  >
                    {/* Fee + period dates (coloured border = status) */}
                    <td className={cn('border-s-4 ps-4 pe-4 py-3', style.border)}>
                      <p
                        className={cn(
                          'text-body font-medium truncate',
                          cancelled ? 'line-through text-text-disabled' : 'text-foreground',
                        )}
                        title={getLabel(period)}
                      >
                        {getLabel(period)}
                      </p>
                      {/* dir on the text only: the paragraph keeps the page's alignment (right in Arabic). */}
                      <p className="text-caption text-text-secondary tabular-nums">
                        <bdi>
                          {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
                        </bdi>
                      </p>
                    </td>

                    {/* Due date */}
                    <td className="px-4 py-3">
                      <p className="text-body text-foreground tabular-nums">
                        <bdi dir="ltr">{formatDate(period.dueDate)}</bdi>
                      </p>
                      {(category === 'due' || category === 'late' || category === 'upcoming') && (
                        <p
                          className={cn(
                            'text-caption',
                            category === 'upcoming' ? 'text-text-secondary' : 'text-danger font-medium',
                          )}
                        >
                          {dueNote(period, category)}
                        </p>
                      )}
                    </td>

                    {/* Amount (original struck through when discounted) */}
                    <td className="px-4 py-3 text-end">
                      <div className="flex flex-col items-end gap-0.5">
                        {discounted && (
                          <span className="text-caption text-text-disabled line-through tabular-nums" dir="ltr">
                            {money(base)}
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-body font-medium tabular-nums whitespace-nowrap',
                            cancelled ? 'line-through text-text-disabled' : 'text-foreground',
                          )}
                          dir="ltr"
                        >
                          {money(period.amountDue)}
                        </span>
                        {discounted && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary whitespace-nowrap"
                            title={applied
                              .map(
                                (d) =>
                                  `${t(`payments.enrollmentDetail.discounts.types.${d.type}`)} ${discountValue(d)}` +
                                  (d.description ? ` (${d.description})` : ''),
                              )
                              .join(' + ')}
                          >
                            <Percent className="w-3 h-3" />
                            {applied.length === 1
                              ? `${discountValue(applied[0])} ${t(`payments.enrollmentDetail.discounts.types.${applied[0].type}`)}`
                              : money(-saved)}
                          </span>
                        )}
                        {partlyPaid && (
                          <span className="text-caption text-success tabular-nums" dir="ltr">
                            {t('payments.enrollmentDetail.periods.paidPart', { amount: money(period.totalPaid ?? 0) })}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Remaining */}
                    <td className="px-4 py-3 text-end">
                      <span
                        className={cn(
                          'text-body font-semibold tabular-nums whitespace-nowrap',
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

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium whitespace-nowrap',
                          style.pill,
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
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
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'discount';
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        tone === 'danger'
          ? 'bg-danger-muted'
          : tone === 'success'
            ? 'bg-success-muted'
            : tone === 'discount'
              ? 'bg-primary/10'
              : 'bg-subtle',
      )}
    >
      <p className="text-caption text-text-secondary">{label}</p>
      <p
        className={cn(
          'text-subsection font-semibold mt-0.5 tabular-nums',
          tone === 'danger'
            ? 'text-danger'
            : tone === 'success'
              ? 'text-success'
              : tone === 'discount'
                ? 'text-primary'
                : 'text-foreground',
        )}
      >
        <bdi dir="ltr">{value}</bdi>
      </p>
    </div>
  );
}
