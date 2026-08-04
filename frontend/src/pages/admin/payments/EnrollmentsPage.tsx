import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CheckCircle } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import {
  Button,
  CreateButton,
  DataTable,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import {
  useEnrollments,
  useCreateEnrollment,
  useBranches,
  type Enrollment,
  type EnrollmentGenerationResult,
} from '@/hooks/useEnrollments';
import { useChildren } from '@/hooks/useChildren';
import { useAcademicYears } from '@/hooks/useAcademicYears';

// ─── Fee Validation ────────────────────────────────────────────────────────────

const FEE_MIN = 0;
const FEE_MAX = 9_999_999.99;

function isValidFee(value: string): boolean {
  if (!value.trim()) return true; // optional fields
  const num = Number(value);
  if (isNaN(num)) return false;
  if (num < FEE_MIN || num > FEE_MAX) return false;
  // Max 2 decimal places
  const parts = value.split('.');
  if (parts.length > 1 && parts[1].length > 2) return false;
  return true;
}

// ─── Create Enrollment Dialog ──────────────────────────────────────────────────

function CreateEnrollmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const createEnrollment = useCreateEnrollment();
  const { data: childrenData } = useChildren({ pageSize: 100 });
  const { data: branches } = useBranches();
  const { data: academicYears } = useAcademicYears();

  const [formData, setFormData] = React.useState({
    childId: '',
    branchId: '',
    academicYearId: '',
    startDate: '',
    recurringFee: '',
    registrationFee: '',
    firstPeriodAmountDue: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [generationResult, setGenerationResult] =
    React.useState<EnrollmentGenerationResult | null>(null);

  function resetForm() {
    setFormData({
      childId: '',
      branchId: '',
      academicYearId: '',
      startDate: '',
      recurringFee: '',
      registrationFee: '',
      firstPeriodAmountDue: '',
    });
    setErrors({});
    setGenerationResult(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.childId) {
      newErrors.childId = t('payments.enrollments.form.childRequired');
    }
    if (!formData.branchId) {
      newErrors.branchId = t('payments.enrollments.form.branchRequired');
    }
    if (!formData.academicYearId) {
      newErrors.academicYearId = t('payments.enrollments.form.academicYearRequired');
    }
    if (!formData.startDate) {
      newErrors.startDate = t('payments.enrollments.form.startDateRequired');
    }

    if (formData.recurringFee && !isValidFee(formData.recurringFee)) {
      newErrors.recurringFee = t('payments.enrollments.form.feeValidation');
    }
    if (formData.registrationFee && !isValidFee(formData.registrationFee)) {
      newErrors.registrationFee = t('payments.enrollments.form.feeValidation');
    }
    if (formData.firstPeriodAmountDue && !isValidFee(formData.firstPeriodAmountDue)) {
      newErrors.firstPeriodAmountDue = t('payments.enrollments.form.feeValidation');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      const result = await createEnrollment.mutateAsync({
        childId: formData.childId,
        branchId: formData.branchId,
        academicYearId: formData.academicYearId,
        startDate: formData.startDate,
        recurringFee: formData.recurringFee
          ? Number(formData.recurringFee)
          : undefined,
        registrationFee: formData.registrationFee
          ? Number(formData.registrationFee)
          : undefined,
        firstPeriodAmountDue: formData.firstPeriodAmountDue
          ? Number(formData.firstPeriodAmountDue)
          : undefined,
      });
      setGenerationResult(result);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  const childOptions = (childrenData?.children ?? []).map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const branchOptions = (branches ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const academicYearOptions = (academicYears ?? []).map((y) => ({
    value: y.id,
    label: y.name,
  }));

  // After successful creation, show result
  if (generationResult) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                {t('payments.enrollments.result.title')}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 bg-subtle rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.enrollments.result.periodsCreated')}
              </span>
              <span className="text-body font-medium text-foreground">
                {generationResult.periodsCreated}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.enrollments.result.dateRange')}
              </span>
              <span className="text-body font-medium text-foreground" dir="ltr">
                {formatDate(generationResult.earliestPeriodStart)}{' '}
                {t('payments.enrollments.result.to')}{' '}
                {formatDate(generationResult.latestPeriodEnd)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.enrollments.result.totalAmount')}
              </span>
              <span className="text-body font-semibold text-foreground">
                {formatDZD(Number(generationResult.totalAmountDue), i18n.language)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => handleClose(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('payments.enrollments.form.title')}</DialogTitle>
          <DialogDescription>
            {t('payments.enrollments.form.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormSelect
              label={t('payments.enrollments.form.child')}
              name="childId"
              value={formData.childId}
              onChange={handleSelectChange}
              options={childOptions}
              placeholder={t('payments.enrollments.form.selectChild')}
              error={errors.childId}
            />

            <FormSelect
              label={t('payments.enrollments.form.branch')}
              name="branchId"
              value={formData.branchId}
              onChange={handleSelectChange}
              options={branchOptions}
              placeholder={t('payments.enrollments.form.selectBranch')}
              error={errors.branchId}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormSelect
              label={t('payments.enrollments.form.academicYear')}
              name="academicYearId"
              value={formData.academicYearId}
              onChange={handleSelectChange}
              options={academicYearOptions}
              placeholder={t('payments.enrollments.form.selectAcademicYear')}
              error={errors.academicYearId}
            />

            <FormField
              label={t('payments.enrollments.form.startDate')}
              htmlFor="enrollment-start-date"
              error={errors.startDate}
              required
            >
              <Input
                id="enrollment-start-date"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('payments.enrollments.form.recurringFee')}
              htmlFor="enrollment-recurring-fee"
              error={errors.recurringFee}
              helperText={t('payments.enrollments.form.recurringFeeHelper')}
            >
              <Input
                id="enrollment-recurring-fee"
                name="recurringFee"
                type="number"
                step="0.01"
                min="0"
                max="9999999.99"
                value={formData.recurringFee}
                onChange={handleChange}
                placeholder="0.00"
              />
            </FormField>

            <FormField
              label={t('payments.enrollments.form.registrationFee')}
              htmlFor="enrollment-registration-fee"
              error={errors.registrationFee}
              helperText={t('payments.enrollments.form.registrationFeeHelper')}
            >
              <Input
                id="enrollment-registration-fee"
                name="registrationFee"
                type="number"
                step="0.01"
                min="0"
                max="9999999.99"
                value={formData.registrationFee}
                onChange={handleChange}
                placeholder="0.00"
              />
            </FormField>
          </div>

          <FormField
            label={t('payments.enrollments.form.firstPeriodAmount')}
            htmlFor="enrollment-first-period-amount"
            error={errors.firstPeriodAmountDue}
            helperText={t('payments.enrollments.form.firstPeriodAmountHelper')}
          >
            <Input
              id="enrollment-first-period-amount"
              name="firstPeriodAmountDue"
              type="number"
              step="0.01"
              min="0"
              max="9999999.99"
              value={formData.firstPeriodAmountDue}
              onChange={handleChange}
              placeholder="0.00"
            />
          </FormField>

          {errors.form && (
            <p className="text-body text-danger mt-1">{errors.form}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createEnrollment.isPending}>
              {createEnrollment.isPending
                ? t('common.loading')
                : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Enrollments Page ──────────────────────────────────────────────────────────

export function EnrollmentsPage() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const pageSize = 10;
  const navigate = useNavigate();

  const { data, isLoading } = useEnrollments({
    page,
    pageSize,
    search: search || undefined,
  });
  const enrollments = data?.enrollments ?? [];
  const total = data?.total ?? 0;

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  function handleSearch(query: string) {
    setSearch(query);
    setPage(1);
  }

  function getStatusVariant(
    status: Enrollment['status']
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

  const columns: Column<Enrollment>[] = [
    {
      key: 'childName',
      header: t('payments.enrollments.columns.childName'),
      sortable: true,
      render: (enrollment) => (
        <span className="text-body font-medium text-foreground">
          {enrollment.child
            ? `${enrollment.child.firstName} ${enrollment.child.lastName}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'academicYear',
      header: t('payments.enrollments.columns.academicYear'),
      render: (enrollment) => (
        <span className="text-body text-foreground">
          {enrollment.academicYear?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('payments.enrollments.columns.status'),
      render: (enrollment) => (
        <StatusBadge variant={getStatusVariant(enrollment.status)}>
          {t(`payments.enrollments.status.${enrollment.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'recurringFee',
      header: t('payments.enrollments.columns.recurringFee'),
      render: (enrollment) => (
        <span className="text-body text-foreground" dir="ltr">
          {formatDZD(Number(enrollment.recurringFee), i18n.language)}
        </span>
      ),
    },
    {
      key: 'startDate',
      header: t('payments.enrollments.columns.startDate'),
      render: (enrollment) => (
        <span className="text-body text-text-secondary" dir="ltr">
          {formatDate(enrollment.startDate)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-primary" />
            <h1 className="text-page-title font-semibold text-text-heading">
              {t('payments.enrollments.title')}
            </h1>
          </div>
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-primary" />
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('payments.enrollments.title')}
          </h1>
        </div>
        <CreateButton
          label={t('payments.enrollments.create')}
          onClick={() => setCreateDialogOpen(true)}
        />
      </div>

      <DataTable<Enrollment>
        columns={columns}
        data={enrollments}
        keyExtractor={(enrollment) => enrollment.id}
        onRowClick={(enrollment) => navigate(`/admin/payments/enrollments/${enrollment.id}`)}
        searchable
        searchPlaceholder={t('payments.enrollments.columns.childName')}
        onSearch={handleSearch}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={t('payments.enrollments.empty')}
      />

      <CreateEnrollmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
