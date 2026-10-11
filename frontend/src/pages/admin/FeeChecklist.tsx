import { useTranslation } from 'react-i18next';
import { formatDZD } from '@/lib/formatters';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useBranchFees, type BranchFee } from '@/hooks/useBranchFees';
import { useClassroomFees } from '@/hooks/useBranchFeeClassrooms';

/**
 * Fees offered when enrolling a child for billing: those of the chosen
 * classroom (or the whole branch when none), whole-school fees applied
 * automatically (shown ticked, locked), the others picked.
 */
export function useOfferedFees(classroomId: string) {
  const { branchId } = useDefaultBranch();
  const { data: classroomFees } = useClassroomFees(classroomId || undefined);
  const { data: branchFees } = useBranchFees(branchId);
  const fees: BranchFee[] = (classroomId ? (classroomFees ?? []) : (branchFees ?? [])).filter(
    (f) => f.showInWizard,
  );
  return {
    branchId,
    fees,
    schoolFees: fees.filter((f) => f.appliesToSchool),
    optionalFees: fees.filter((f) => !f.appliesToSchool),
  };
}

export function useFeeLabel() {
  const { t, i18n } = useTranslation();
  return (fee: BranchFee): string => {
    const cycle =
      fee.billingCycle === 'monthly'
        ? t('children.wizard.fees.perMonth')
        : fee.billingCycle === 'custom'
          ? t('children.wizard.fees.perPeriod')
          : t('children.wizard.fees.oneTime');
    return `${fee.name} — ${formatDZD(Number(fee.amount), i18n.language)} ${cycle}`;
  };
}

/** The fee list with checkboxes; `selectedFeeIds` holds the picked optional fees. */
export function FeeChecklist({
  classroomId,
  selectedFeeIds,
  onChange,
}: {
  classroomId: string;
  selectedFeeIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const feeLabel = useFeeLabel();
  const { fees, schoolFees, optionalFees } = useOfferedFees(classroomId);
  const selected = selectedFeeIds.filter((id) => optionalFees.some((f) => f.id === id));

  function toggleFee(id: string) {
    onChange(selected.includes(id) ? selected.filter((f) => f !== id) : [...selected, id]);
  }

  if (fees.length === 0) {
    return <p className="text-caption text-text-secondary">{t('children.wizard.fees.noFees')}</p>;
  }

  return (
    <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
      {schoolFees.map((fee) => (
        <label key={fee.id} className="flex items-center gap-2 p-2 opacity-90">
          <input
            type="checkbox"
            checked
            disabled
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-caption text-foreground flex-1">{feeLabel(fee)}</span>
          <span className="text-micro text-primary font-medium">{t('children.wizard.fees.schoolWide')}</span>
        </label>
      ))}
      {optionalFees.map((fee) => (
        <label key={fee.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-hover">
          <input
            type="checkbox"
            checked={selected.includes(fee.id)}
            onChange={() => toggleFee(fee.id)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-caption text-foreground">{feeLabel(fee)}</span>
        </label>
      ))}
    </div>
  );
}

/** A date (YYYY-MM-DD) kept inside a school year's range. */
export function clampToAcademicYear(date: string, startDate: string, endDate: string): string {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  if (date < start) return start;
  if (date > end) return end;
  return date;
}
