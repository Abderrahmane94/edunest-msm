import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Mail, Star } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { useChildBillingPeriods, type BillingPeriod as ChildPeriod } from '@/hooks/usePayments';
import { useParentLinks } from '@/hooks/useChildren';
import type { BillingPeriod } from '@/hooks/useEnrollments';
import { EcheancesSection } from './EcheancesSection';

/** The child-periods API sends the fee flat; EcheancesSection reads it nested. */
function toEcheance(p: ChildPeriod): BillingPeriod {
  return {
    ...p,
    status: p.status as BillingPeriod['status'],
    branchFee: p.branchFeeName
      ? {
          id: p.branchFeeId ?? '',
          name: p.branchFeeName,
          billingCycle: (p.branchFeeBillingCycle ?? null) as 'monthly' | 'custom' | null,
        }
      : null,
  };
}

/**
 * A child's whole account, opened from a late-payments row: every échéance
 * (paid, late, upcoming) with the totals, and the parents to contact — so
 * staff see the full picture before reminding or calling.
 */
export function ChildAccountDialog({
  childId,
  childName,
  open,
  onOpenChange,
}: {
  childId: string;
  childName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Only fetch while open.
  const { data: periods, isLoading } = useChildBillingPeriods(open ? childId : '');
  const { data: parentLinks } = useParentLinks(open ? childId : '');

  const echeances = React.useMemo(() => (periods ?? []).map(toEcheance), [periods]);

  function getLabel(period: BillingPeriod): string {
    if (period.isRegistrationPeriod) return t('payments.enrollmentDetail.periods.registration');
    // One-off fee: just its name. Recurring fee: its name and the month.
    if (period.branchFee && !period.branchFee.billingCycle) return period.branchFee.name;
    const month = new Date(period.periodStart).toLocaleDateString(i18n.language === 'ar' ? 'ar-DZ' : 'fr-DZ', {
      month: 'long',
      year: 'numeric',
    });
    return period.branchFee ? `${period.branchFee.name} — ${month}` : month;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('payments.late.account.title', { name: childName })}</DialogTitle>
          <DialogDescription>{t('payments.late.account.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Parents to contact */}
          <div className="rounded-lg border border-border p-3">
            <p className="text-caption font-medium text-text-secondary mb-2">{t('payments.late.account.parents')}</p>
            {(parentLinks ?? []).length === 0 ? (
              <p className="text-body text-text-secondary">{t('payments.late.account.noParents')}</p>
            ) : (
              <ul className="space-y-1.5">
                {(parentLinks as Record<string, unknown>[]).map((link) => {
                  const parent = link.parent as Record<string, unknown>;
                  const email = parent.email as string | undefined;
                  return (
                    <li key={link.id as string} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-body font-medium text-foreground">
                        {parent.firstName as string} {parent.lastName as string}
                      </span>
                      <span className="text-caption text-text-secondary">({link.relationship as string})</span>
                      {!!link.isPrimary && (
                        <span className="inline-flex items-center gap-1 text-micro text-primary">
                          <Star className="w-3 h-3" />
                          {t('payments.late.account.primary')}
                        </span>
                      )}
                      {email && (
                        <a
                          href={`mailto:${email}`}
                          className="inline-flex items-center gap-1 text-caption text-primary hover:underline"
                          dir="ltr"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          {email}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-hover rounded-md" />
              ))}
            </div>
          ) : (
            <EcheancesSection periods={echeances} getLabel={getLabel} />
          )}

          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/admin/children/${childId}`)}>
              <ExternalLink className="w-4 h-4" />
              {t('payments.late.account.openChild')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
