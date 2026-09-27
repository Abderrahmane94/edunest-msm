import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/ui';
import { formatDZD } from '@/lib/formatters';
import { useClassroomFees } from '@/hooks/useBranchFeeClassrooms';
import type { BranchFee } from '@/hooks/useBranchFees';

/**
 * Fees assigned to a classroom: fees linked to it (by assigning them to this
 * class from /payments) plus whole-school fees.
 */
export function ClassroomFeesSection({ classroomId }: { classroomId: string }) {
  const { t, i18n } = useTranslation();
  const { data: fees, isLoading, isError, error } = useClassroomFees(classroomId);

  function cycleLabel(fee: BranchFee): string {
    if (fee.billingCycle === 'monthly') return t('payments.branchConfig.cycleMonthly');
    if (fee.billingCycle === 'custom') return t('payments.branchConfig.cycleCustom');
    return t('children.fees.oneShot');
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <h2 className="text-subsection font-semibold text-text-heading">{t('classrooms.fees.title')}</h2>

      {isLoading ? (
        <div className="animate-pulse h-16 bg-subtle rounded-md" />
      ) : isError ? (
        <p className="text-body text-danger">{error instanceof Error ? error.message : t('common.error')}</p>
      ) : !fees || fees.length === 0 ? (
        <p className="text-body text-text-secondary">{t('classrooms.fees.empty')}</p>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-subtle rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-body font-medium text-foreground">{fee.name}</span>
                <p className="text-caption text-text-secondary">{cycleLabel(fee)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant={fee.appliesToSchool ? 'sent' : 'draft'}>
                  {fee.appliesToSchool ? t('payments.fees.scopeSchool') : t('classrooms.fees.linked')}
                </StatusBadge>
                <span className="text-body font-medium text-foreground">
                  {formatDZD(Number(fee.amount), i18n.language)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
