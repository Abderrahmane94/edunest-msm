import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, UserX, Calendar, Plus, Trash2, Percent } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  ErrorAlert,
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
import { FormField, FormSelect } from '@/components/forms';
import { ChildFeesSection } from '@/pages/admin/ChildFeesSection';
import { EcheancesSection } from './EcheancesSection';
import {
  useEnrollmentDetail,
  useWithdrawEnrollment,
  type BillingPeriod,
} from '@/hooks/useEnrollments';
import {
  useDiscounts,
  useCreateDiscount,
  useDeleteDiscount,
  type Discount,
  type DiscountType,
} from '@/hooks/useDiscounts';

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
      // Shown from withdrawEnrollment.error above the buttons.
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

// ─── Discounts ──────────────────────────────────────────────────────────────

const DISCOUNT_TYPE_KEYS: DiscountType[] = ['scholarship', 'sibling', 'staff', 'custom'];

function AddDiscountDialog({
  open,
  onOpenChange,
  enrollmentId,
  recurringFees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  /** The child's recurring fees a discount can target. */
  recurringFees: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const createDiscount = useCreateDiscount(enrollmentId);

  const [type, setType] = React.useState<DiscountType>('scholarship');
  const [branchFeeId, setBranchFeeId] = React.useState('');
  const [percentage, setPercentage] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [validFrom, setValidFrom] = React.useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = React.useState('');

  function resetForm() {
    setType('scholarship');
    setBranchFeeId('');
    createDiscount.reset();
    setPercentage('');
    setDescription('');
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo('');
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!percentage || !validFrom) return;

    createDiscount.mutate(
      {
        type,
        percentage: Number(percentage),
        description: description.trim() || null,
        validFrom,
        validTo: validTo || null,
        branchFeeId: branchFeeId || null,
      },
      { onSuccess: () => handleClose(false) },
    );
  }

  const typeOptions = DISCOUNT_TYPE_KEYS.map((key) => ({
    value: key,
    label: t(`payments.enrollmentDetail.discounts.types.${key}`),
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary" />
            {t('payments.enrollmentDetail.discounts.form.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label={t('payments.enrollmentDetail.discounts.form.type')}
            name="discount-type"
            value={type}
            onChange={(e) => setType(e.target.value as DiscountType)}
            options={typeOptions}
          />

          <FormSelect
            label={t('payments.enrollmentDetail.discounts.form.fee')}
            name="discount-fee"
            value={branchFeeId}
            onChange={(e) => setBranchFeeId(e.target.value)}
            options={[
              { value: '', label: t('payments.enrollmentDetail.discounts.allRecurringFees') },
              ...recurringFees.map((f) => ({ value: f.id, label: f.name })),
            ]}
            helperText={t('payments.enrollmentDetail.discounts.form.feeHelper')}
          />

          <FormField label={t('payments.enrollmentDetail.discounts.form.percentage')} htmlFor="discount-percentage" required>
            <Input
              id="discount-percentage"
              name="discount-percentage"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField label={t('payments.enrollmentDetail.discounts.form.description')} htmlFor="discount-description">
            <Input
              id="discount-description"
              name="discount-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('payments.enrollmentDetail.discounts.form.validFrom')} htmlFor="discount-valid-from" required>
              <Input
                id="discount-valid-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </FormField>

            <FormField label={t('payments.enrollmentDetail.discounts.form.validTo')} htmlFor="discount-valid-to">
              <Input
                id="discount-valid-to"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
              />
            </FormField>
          </div>

          {createDiscount.isError && (
            <p className="text-body text-danger mt-1">
              {createDiscount.error instanceof Error ? createDiscount.error.message : t('common.error')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <ErrorAlert
              message={createDiscount.isError ? (createDiscount.error instanceof Error ? createDiscount.error.message : t('common.error')) : null}
              className="me-auto"
            />
            <Button type="submit" variant="primary" disabled={!percentage || !validFrom || createDiscount.isPending}>
              {createDiscount.isPending ? t('common.loading') : t('payments.enrollmentDetail.discounts.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DiscountRow({ discount, enrollmentId }: { discount: Discount; enrollmentId: string }) {
  const { t } = useTranslation();
  const deleteDiscount = useDeleteDiscount(enrollmentId);
  const [confirming, setConfirming] = React.useState(false);

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-hover">
      <td className="px-4 py-3">
        <span className="text-body font-medium text-foreground">
          {t(`payments.enrollmentDetail.discounts.types.${discount.type}`)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-body font-medium text-foreground" dir="ltr">
          {Number(discount.percentage)}%
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-body text-foreground">
          {discount.branchFee?.name ?? t('payments.enrollmentDetail.discounts.allRecurringFees')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-body text-text-secondary" dir="ltr">
          {formatDate(discount.validFrom)} —{' '}
          {discount.validTo ? formatDate(discount.validTo) : t('payments.enrollmentDetail.discounts.noExpiry')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-body text-text-secondary truncate max-w-[200px] block">
          {discount.description || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-end">
        {confirming ? (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteDiscount.mutate(discount.id)}
              disabled={deleteDiscount.isPending}
            >
              {deleteDiscount.isPending ? t('common.loading') : t('payments.enrollmentDetail.discounts.delete')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={t('payments.enrollmentDetail.discounts.delete')}>
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function DiscountsSection({
  enrollmentId,
  recurringFees,
}: {
  enrollmentId: string;
  recurringFees: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const { data: discounts, isLoading } = useDiscounts(enrollmentId);
  const [showAddDialog, setShowAddDialog] = React.useState(false);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-section-title font-semibold text-text-heading">
            {t('payments.enrollmentDetail.discounts.title')}
          </h2>
          <p className="text-caption text-text-secondary mt-1">
            {t('payments.enrollmentDetail.discounts.description', { count: discounts?.length ?? 0 })}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4" />
          {t('payments.enrollmentDetail.discounts.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-10 bg-hover rounded-md animate-pulse" />
          ))}
        </div>
      ) : !discounts || discounts.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-body text-text-secondary">{t('payments.enrollmentDetail.discounts.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-subtle">
                <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                  {t('payments.enrollmentDetail.discounts.columns.type')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                  {t('payments.enrollmentDetail.discounts.columns.percentage')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                  {t('payments.enrollmentDetail.discounts.columns.fee')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                  {t('payments.enrollmentDetail.discounts.columns.validity')}
                </th>
                <th className="px-4 py-3 text-start text-caption font-medium text-text-secondary">
                  {t('payments.enrollmentDetail.discounts.columns.description')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <DiscountRow key={discount.id} discount={discount} enrollmentId={enrollmentId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddDiscountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        enrollmentId={enrollmentId}
        recurringFees={recurringFees}
      />
    </div>
  );
}

// ─── Enrollment Detail Page ────────────────────────────────────────────────────

export function EnrollmentDetailPage() {
  const { t, i18n } = useTranslation();
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();

  const { data: enrollment, isLoading } = useEnrollmentDetail(enrollmentId!);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);

  // The recurring fees billed on this enrollment — what a discount can target.
  const recurringFees = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of enrollment?.billingPeriods ?? []) {
      if (p.branchFee?.billingCycle) byId.set(p.branchFee.id, p.branchFee.name);
    }
    return [...byId].map(([id, name]) => ({ id, name }));
  }, [enrollment]);

  // Back to the child's page (where this page is opened from), or to payments
  // while the enrollment isn't loaded.
  function goBack() {
    navigate(enrollment?.childId ? `/admin/children/${enrollment.childId}` : '/admin/payments');
  }

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
    // One-off fee: just its name. Recurring fee: its name and the month.
    if (period.branchFee && !period.branchFee.billingCycle) {
      return period.branchFee.name;
    }
    const prefix = period.branchFee ? `${period.branchFee.name} — ` : '';
    return prefix + monthLabel(period);
  }

  function monthLabel(period: BillingPeriod): string {
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
            onClick={goBack}
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
            onClick={goBack}
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
            onClick={goBack}
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
              {t('payments.enrollments.columns.startDate')}
            </span>
            <span className="text-body font-medium text-foreground" dir="ltr">
              {formatDate(enrollment.startDate)}
            </span>
          </div>
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

      {/* Échéances */}
      <EcheancesSection periods={billingPeriods} getLabel={getPeriodLabel} />

      {/* The child's fees and what's left to pay */}
      <ChildFeesSection childId={enrollment.childId} showManageBilling={false} />

      {/* Discounts */}
      <DiscountsSection enrollmentId={enrollmentId!} recurringFees={recurringFees} />

      {/* Withdrawal Dialog */}
      <WithdrawalDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        enrollmentId={enrollmentId!}
      />
    </div>
  );
}
