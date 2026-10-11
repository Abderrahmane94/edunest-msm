import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PlusCircle, Settings2 } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ErrorAlert, Input,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { formatDZD } from '@/lib/formatters';
import { useChildBillingPeriods, type BillingPeriod } from '@/hooks/usePayments';
import { useCreateEnrollment } from '@/hooks/useEnrollments';
import { setSelectedYearId, useSelectedYear, useYearClosed } from '@/hooks/useSelectedYear';
import type { AcademicYear } from '@/hooks/useAcademicYears';
import { FeeChecklist, clampToAcademicYear, useOfferedFees } from './FeeChecklist';

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
 *
 * `amountDue` only counts what the parent owes now: the unpaid part of every
 * period whose due date has passed, plus the next upcoming unpaid period —
 * not every period until the end of the school year.
 */
export function groupByFee(periods: BillingPeriod[], today: string): AssignedFee[] {
  const groups = new Map<string, AssignedFee>();
  const hasNextUpcoming = new Set<string>();
  const sorted = [...periods].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const p of sorted) {
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
    group.totalPaid += Number(p.totalPaid ?? 0);
    group.outstanding += Number(p.outstanding ?? 0);

    const remaining = Number(p.outstanding ?? p.amountDue);
    if (remaining <= 0) continue;
    if (p.dueDate.slice(0, 10) <= today) {
      group.amountDue += remaining;
    } else if (!hasNextUpcoming.has(key)) {
      hasNextUpcoming.add(key);
      group.amountDue += remaining;
    }
  }
  return [...groups.values()];
}

/** Today's date as YYYY-MM-DD in the viewer's local time zone. */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Enrolls a child in a school year's billing: the fees picked, billed from a start date. */
function BillingEnrollDialog({
  open,
  onOpenChange,
  childId,
  childName,
  classroomId,
  year,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  childName: string;
  classroomId: string;
  year: AcademicYear;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const createEnrollment = useCreateEnrollment();
  const { branchId, schoolFees, optionalFees } = useOfferedFees(classroomId);
  const [feeIds, setFeeIds] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFeeIds([]);
    setError(null);
    setStartDate(clampToAcademicYear(localToday(), year.start_date, year.end_date));
  }, [open, year]);

  const picked = feeIds.filter((id) => optionalFees.some((f) => f.id === id));
  const canEnroll = !!branchId && !!startDate && (schoolFees.length > 0 || picked.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEnroll) return;
    setError(null);
    try {
      await createEnrollment.mutateAsync({
        childId,
        branchId,
        academicYearId: year.id,
        startDate: clampToAcademicYear(startDate, year.start_date, year.end_date),
        feeIds: picked,
      });
      await qc.invalidateQueries({ queryKey: ['child-billing-periods', childId] });
      await qc.invalidateQueries({ queryKey: ['children'] });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('children.fees.enrollTitle', { year: year.name })}</DialogTitle>
          <DialogDescription>{t('children.fees.enrollDescription', { name: childName })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FeeChecklist classroomId={classroomId} selectedFeeIds={feeIds} onChange={setFeeIds} />
          <FormField label={t('children.fees.startDate')} htmlFor="billing-start" required>
            <Input
              id="billing-start"
              type="date"
              value={startDate}
              min={year.start_date.slice(0, 10)}
              max={year.end_date.slice(0, 10)}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <ErrorAlert message={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canEnroll || createEnrollment.isPending}>
              {createEnrollment.isPending ? t('common.loading') : t('children.fees.enrollAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChildFeesSection({
  childId,
  childName = '',
  classroomId = '',
  unpaidOtherYears = [],
  showManageBilling = true,
}: {
  childId: string;
  childName?: string;
  /** The child's class this year: its fees are the ones offered. */
  classroomId?: string;
  /** Still owed from earlier years: it stays in its year, collected from there. */
  unpaidOtherYears?: { id: string; name: string; amount: string }[];
  /** Hidden on the billing page itself. */
  showManageBilling?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { data: periods, isLoading, isError, error } = useChildBillingPeriods(childId);
  // The fees shown are those of the year being looked at (admins).
  const { year, enabled: byYear } = useSelectedYear();
  // A closed year is looked at, not changed.
  const closed = useYearClosed();
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const notBilled = byYear && !!year && !isLoading && !isError && (periods ?? []).length === 0;
  const fees = React.useMemo(() => groupByFee(periods ?? [], localToday()), [periods]);
  const navigate = useNavigate();

  // The child's current billing enrollment (withdrawal, discounts): the one
  // holding their most recent billing period.
  const currentEnrollmentId = React.useMemo(() => {
    let latest: { id: string; start: string } | null = null;
    for (const p of periods ?? []) {
      if (!latest || p.periodStart > latest.start) latest = { id: p.enrollmentId, start: p.periodStart };
    }
    return latest?.id ?? null;
  }, [periods]);

  function cycleLabel(fee: AssignedFee): string {
    if (fee.isRegistration) return t('children.fees.registration');
    if (fee.billingCycle === 'monthly') return t('payments.branchConfig.cycleMonthly');
    if (fee.billingCycle === 'custom') return t('payments.branchConfig.cycleCustom');
    return t('children.fees.oneShot');
  }

  const money = (v: number) => formatDZD(v, i18n.language);

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-subsection font-semibold text-text-heading">
          {byYear && year ? t('children.fees.titleInYear', { year: year.name }) : t('children.fees.title')}
        </h2>
        {showManageBilling && notBilled && !closed && (
          <Button type="button" size="sm" onClick={() => setEnrollOpen(true)}>
            <PlusCircle className="w-4 h-4" />
            {t('children.fees.enroll')}
          </Button>
        )}
        {showManageBilling && currentEnrollmentId && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/admin/payments/enrollments/${currentEnrollmentId}`)}
          >
            <Settings2 className="w-4 h-4" />
            {t('children.fees.manageBilling')}
          </Button>
        )}
      </div>

      {unpaidOtherYears.length > 0 && (
        <div className="rounded-md bg-warning-muted p-3 space-y-1">
          <p className="text-body font-medium text-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-warning" />
            {t('children.fees.unpaidOtherYears')}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {unpaidOtherYears.map((u) => (
              <li key={u.id} className="text-caption text-foreground flex items-center gap-2">
                {t('children.fees.unpaidYear', { year: `⁦${u.name}⁩`, amount: money(Number(u.amount)) })}
                <button
                  type="button"
                  onClick={() => setSelectedYearId(u.id)}
                  className="text-primary hover:underline"
                >
                  {t('children.fees.seeYear', { year: `⁦${u.name}⁩` })}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse h-16 bg-subtle rounded-md" />
      ) : isError ? (
        <p className="text-body text-danger">{errorMessage(error, t)}</p>
      ) : notBilled ? (
        <p className="text-body text-text-secondary">{t('children.fees.notBilled', { name: childName, year: year!.name })}</p>
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

      {year && (
        <BillingEnrollDialog
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          childId={childId}
          childName={childName}
          classroomId={classroomId}
          year={year}
        />
      )}
    </div>
  );
}
