import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, UserX, Calendar } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import {
  Button,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import {
  useEnrollmentDetail,
  useWithdrawEnrollment,
  type BillingPeriod,
} from '@/hooks/useEnrollments';

// ─── Period Status Badge ───────────────────────────────────────────────────────

function PeriodStatusBadge({ period }: { period: BillingPeriod }) {
  const { t } = useTranslation();

  if (period.cancelledAt) {
    return (
      <StatusBadge variant="cancelled">
        {t('payments.enrollmentDetail.periodStatus.cancelled')}
      </StatusBadge>
    );
  }

  const status = period.status;
  const variantMap: Record<string, 'draft' | 'partial' | 'overdue' | 'late' | 'paid'> = {
    unpaid: 'draft',
    partial: 'partial',
    late_partial: 'overdue',
    late: 'late',
    paid: 'paid',
  };

  const variant = status ? variantMap[status] ?? 'draft' : 'draft';

  return (
    <StatusBadge variant={variant}>
      {status
        ? t(`payments.enrollmentDetail.periodStatus.${status}`)
        : t('payments.enrollmentDetail.periodStatus.unpaid')}
    </StatusBadge>
  );
}

// ─── Withdrawal Dialog ─────────────────────────────────────────────────────────

function WithdrawalDialog({
  open,
  onOpenChange,
  enrollmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
}) {
  const { t } = useTranslation();
  const withdrawEnrollment = useWithdrawEnrollment();

  const [withdrawalDate, setWithdrawalDate] = React.useState('');
  const [amountDue, setAmountDue] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function resetForm() {
    setWithdrawalDate('');
    setAmountDue('');
    setErrors({});
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!withdrawalDate) {
      newErrors.withdrawalDate = t('payments.enrollmentDetail.withdrawal.dateRequired');
    }

    if (amountDue) {
      const num = Number(amountDue);
      if (isNaN(num) || num < 0 || num > 9_999_999.99) {
        newErrors.amountDue = t('payments.enrollments.form.feeValidation');
      }
      const parts = amountDue.split('.');
      if (parts.length > 1 && parts[1].length > 2) {
        newErrors.amountDue = t('payments.enrollments.form.feeValidation');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await withdrawEnrollment.mutateAsync({
        enrollmentId,
        data: {
          withdrawalDate,
          amountDue: amountDue ? Number(amountDue) : undefined,
        },
      });
      handleClose(false);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-danger" />
            {t('payments.enrollmentDetail.withdrawal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('payments.enrollmentDetail.withdrawal.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormField
            label={t('payments.enrollmentDetail.withdrawal.date')}
            htmlFor="withdrawal-date"
            error={errors.withdrawalDate}
            required
          >
            <Input
              id="withdrawal-date"
              name="withdrawalDate"
              type="date"
              value={withdrawalDate}
              onChange={(e) => setWithdrawalDate(e.target.value)}
            />
          </FormField>

          <FormField
            label={t('payments.enrollmentDetail.withdrawal.amountDue')}
            htmlFor="withdrawal-amount-due"
            error={errors.amountDue}
            helperText={t('payments.enrollmentDetail.withdrawal.amountDueHelper')}
          >
            <Input
              id="withdrawal-amount-due"
              name="amountDue"
              type="number"
              step="0.01"
              min="0"
              max="9999999.99"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          {withdrawEnrollment.isError && (
            <p className="text-body text-danger mt-1">
              {withdrawEnrollment.error instanceof Error
                ? withdrawEnrollment.error.message
                : t('common.error')}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={withdrawEnrollment.isPending}
            >
              {withdrawEnrollment.isPending
                ? t('common.loading')
                : t('payments.enrollmentDetail.withdrawal.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Enrollment Detail Page ────────────────────────────────────────────────────

export function EnrollmentDetailPage() {
  const { t, i18n } = useTranslation();
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();

  const { data: enrollment, isLoading } = useEnrollmentDetail(enrollmentId!);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);

  function getStatusVariant(
    status: string
  ): 'present' | 'cancelled' | 'draft' {
    switch (status) {
      case 'active':
        return 'present';
      case 'withdrawn':
        return 'cancelled';
      case 'completed':
        return 'draft';
      default:
        return 'draft';
    }
  }

  function getPeriodLabel(period: BillingPeriod): string {
    if (period.isRegistrationPeriod) {
      return t('payments.enrollmentDetail.periods.registration');
    }
    // Format as month label from period_start
    try {
      const date = new Date(period.periodStart);
      return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-DZ' : 'fr-DZ', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return formatDate(period.periodStart);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/payments/enrollments')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('payments.enrollmentDetail.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/payments/enrollments')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('payments.enrollmentDetail.title')}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-body text-text-secondary">
            {t('payments.enrollmentDetail.notFound')}
          </p>
        </div>
      </div>
    );
  }

  const billingPeriods = enrollment.billingPeriods ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/payments/enrollments')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Calendar className="w-6 h-6 text-primary" />
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('payments.enrollmentDetail.title')}
          </h1>
        </div>
        {enrollment.status === 'active' && (
          <Button
            variant="danger"
            onClick={() => setWithdrawDialogOpen(true)}
          >
            <UserX className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {t('payments.enrollmentDetail.withdraw')}
          </Button>
        )}
      </div>

      {/* Enrollment Info Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-section-title font-semibold text-text-heading mb-4">
          {t('payments.enrollmentDetail.info')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <span className="text-caption text-text-secondary block">
              {t('payments.enrollments.columns.childName')}
            </span>
            <span className="text-body font-medium text-foreground">
              {enrollment.child
                ? `${enrollment.child.firstName} ${enrollment.child.lastName}`
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-caption text-text-secondary block">
              {t('payments.enrollments.form.branch')}
            </span>
            <span className="text-body font-medium text-foreground">
              {enrollment.branch?.name ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-caption text-text-secondary block">
              {t('payments.enrollments.columns.academicYear')}
            </span>
            <span className="text-body font-medium text-foreground">
              {enrollment.academicYear?.name ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-caption text-text-secondary block">
              {t('payments.enrollments.columns.status')}
            </span>
            <StatusBadge variant={getStatusVariant(enrollment.status)}>
              {t(`payments.enrollments.status.${enrollment.status}`)}
            </StatusBadge>
          </div>
          <div>
            <span className="text-caption text-text-secondary block">
              {t('payments.enrollments.columns.recurringFee')}
            </span>
            <span className="text-body font-medium text-foreground" dir="ltr">
              {formatDZD(Number(enrollment.recurringFee), i18n.language)}
            </span>
          </div>
          <div>
            <span className="text-caption text-text-secondary block">
              {t('payments.enrollments.columns.startDate')}
            </span>
            <span className="text-body font-medium text-foreground" dir="ltr">
              {formatDate(enrollment.startDate)}
            </span>
          </div>
          {enrollment.registrationFee && (
            <div>
              <span className="text-caption text-text-secondary block">
                {t('payments.enrollments.form.registrationFee')}
              </span>
              <span className="text-body font-medium text-foreground" dir="ltr">
                {formatDZD(Number(enrollment.registrationFee), i18n.language)}
              </span>
            </div>
          )}
          {enrollment.withdrawalDate && (
            <div>
              <span className="text-caption text-text-secondary block">
                {t('payments.enrollmentDetail.withdrawalDate')}
              </span>
              <span className="text-body font-medium text-danger" dir="ltr">
                {formatDate(enrollment.withdrawalDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Billing Periods Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-section-title font-semibold text-text-heading">
            {t('payments.enrollmentDetail.periods.title')}
          </h2>
          <p className="text-caption text-text-secondary mt-1">
            {t('payments.enrollmentDetail.periods.description', {
              count: billingPeriods.length,
            })}
          </p>
        </div>

        {billingPeriods.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-body text-text-secondary">
              {t('payments.enrollmentDetail.periods.empty')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-subtle">
                  <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                    {t('payments.enrollmentDetail.periods.columns.period')}
                  </th>
                  <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                    {t('payments.enrollmentDetail.periods.columns.dates')}
                  </th>
                  <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                    {t('payments.enrollmentDetail.periods.columns.amountDue')}
                  </th>
                  <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                    {t('payments.enrollmentDetail.periods.columns.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {billingPeriods.map((period) => (
                  <tr
                    key={period.id}
                    className={`border-b border-border last:border-b-0 ${
                      period.cancelledAt
                        ? 'bg-subtle/50 opacity-60'
                        : 'hover:bg-hover'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`text-body font-medium ${
                          period.cancelledAt
                            ? 'line-through text-text-disabled'
                            : 'text-foreground'
                        }`}
                      >
                        {getPeriodLabel(period)}
                      </span>
                      {period.cancelledAt && (
                        <span className="ms-2 text-micro text-danger font-medium">
                          {t('payments.enrollmentDetail.periodStatus.cancelled')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-body ${
                          period.cancelledAt
                            ? 'line-through text-text-disabled'
                            : 'text-text-secondary'
                        }`}
                        dir="ltr"
                      >
                        {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-body ${
                          period.cancelledAt
                            ? 'line-through text-text-disabled'
                            : 'text-foreground font-medium'
                        }`}
                        dir="ltr"
                      >
                        {formatDZD(Number(period.amountDue), i18n.language)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PeriodStatusBadge period={period} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal Dialog */}
      <WithdrawalDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        enrollmentId={enrollmentId!}
      />
    </div>
  );
}
