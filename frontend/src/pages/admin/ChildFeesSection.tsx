import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDZD } from '@/lib/formatters';
import { useChildBillingPeriods, type BillingPeriod } from '@/hooks/usePayments';

interface AssignedFee {
  key: string;
  name: string;
  billingCycle: string | null;
  isRegistration: boolean;
  periods: number;
  amountDue: number;
  totalPaid: number;
  outstanding: number;
}

/**
 * Groups a child's non-cancelled billing periods by the fee they were
 * generated from, so each assigned fee shows once with its totals.
 */
function groupByFee(periods: BillingPeriod[]): AssignedFee[] {
  const groups = new Map<string, AssignedFee>();
  for (const p of periods) {
    if (p.cancelledAt) continue;
    const key = p.isRegistrationPeriod ? 'registration' : (p.branchFeeId ?? p.branchFeeName ?? 'unknown');
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: p.branchFeeName ?? '',
        billingCycle: p.branchFeeBillingCycle ?? null,
        isRegistration: p.isRegistrationPeriod,
        periods: 0,
        amountDue: 0,
        totalPaid: 0,
        outstanding: 0,
      };
      groups.set(key, group);
    }
    group.periods += 1;
    group.amountDue += Number(p.amountDue);
    group.totalPaid += Number(p.totalPaid ?? 0);
    group.outstanding += Number(p.outstanding ?? 0);
  }
  return [...groups.values()];
}

export function ChildFeesSection({ childId }: { childId: string }) {
  const { t, i18n } = useTranslation();
  const { data: periods, isLoading, isError, error } = useChildBillingPeriods(childId);
  const fees = React.useMemo(() => groupByFee(periods ?? []), [periods]);

  function cycleLabel(fee: AssignedFee): string {
    if (fee.isRegistration) return t('children.fees.registration');
    if (fee.billingCycle === 'monthly') return t('payments.branchConfig.cycleMonthly');
    if (fee.billingCycle === 'custom') return t('payments.branchConfig.cycleCustom');
    return t('children.fees.oneShot');
  }

  const money = (v: number) => formatDZD(v, i18n.language);

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <h2 className="text-subsection font-semibold text-text-heading">{t('children.fees.title')}</h2>

      {isLoading ? (
        <div className="animate-pulse h-16 bg-subtle rounded-md" />
      ) : isError ? (
        <p className="text-body text-danger">{error instanceof Error ? error.message : t('common.error')}</p>
      ) : fees.length === 0 ? (
        <p className="text-body text-text-secondary">{t('children.fees.empty')}</p>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => (
            <div
              key={fee.key}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-subtle rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-body font-medium text-foreground">
                  {fee.isRegistration ? t('children.fees.registration') : fee.name}
                </span>
                <p className="text-caption text-text-secondary">
                  {fee.isRegistration ? '' : cycleLabel(fee)}
                  {fee.periods > 1 && (
                    <span>
                      {fee.isRegistration ? '' : ' • '}
                      {t('children.fees.periods', { count: fee.periods })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-4 text-caption">
                <span className="text-text-secondary">
                  {t('children.fees.due')} <span className="text-foreground font-medium">{money(fee.amountDue)}</span>
                </span>
                <span className="text-text-secondary">
                  {t('children.fees.paid')} <span className="text-success font-medium">{money(fee.totalPaid)}</span>
                </span>
                <span className="text-text-secondary">
                  {t('children.fees.outstanding')}{' '}
                  <span className={fee.outstanding > 0 ? 'text-danger font-medium' : 'text-foreground font-medium'}>
                    {money(fee.outstanding)}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
