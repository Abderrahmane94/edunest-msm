import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Edit2, Eye, DollarSign, Users, CalendarDays, Plus } from 'lucide-react';
import {
  Button,
  CreateButton,
  DataTable,
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
import { formatDZD } from '@/lib/formatters';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useChildren } from '@/hooks/useChildren';
import { useClassrooms } from '@/hooks/useClassrooms';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useFeePeriods, useSetFeePeriods } from '@/hooks/useBranchFeePeriods';
import { useFeeClassrooms } from '@/hooks/useBranchFeeClassrooms';
import { useBranchCalendar, useCreateBranchCalendar } from '@/hooks/useBranchCalendar';
import {
  useBranchFees,
  useCreateBranchFee,
  useUpdateBranchFee,
  useDeleteBranchFee,
  useAssignFee,
  useChangeFeeScope,
  feeScopeOf,
  type BranchFee,
  type BillingCycle,
  type AssignFeeResult,
  type FeeScope,
  type ChangeFeeScopeResult,
} from '@/hooks/useBranchFees';

// ─── New Period (inline, inside the fee dialog) ──────────────────────────────

/**
 * Creates a calendar period without leaving the fee dialog; the new period is
 * ticked for the fee straight away. Not a nested <form> (it sits inside the
 * fee's form), so Enter is handled by hand.
 */
function NewPeriodForm({
  branchId,
  academicYearId,
  yearStart,
  yearEnd,
  onCreated,
}: {
  branchId: string;
  academicYearId: string;
  yearStart?: string;
  yearEnd?: string;
  onCreated: (periodId: string) => void;
}) {
  const { t } = useTranslation();
  const createPeriod = useCreateBranchCalendar();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setLabel('');
    setStart('');
    setEnd('');
    setError(null);
  }

  async function handleCreate() {
    if (!label.trim() || !start || !end) {
      setError(t('payments.fees.newPeriod.required'));
      return;
    }
    if (end < start) {
      setError(t('payments.fees.newPeriod.endBeforeStart'));
      return;
    }
    setError(null);
    try {
      const created = await createPeriod.mutateAsync({
        branchId,
        label: label.trim(),
        period_start: start,
        period_end: end,
        academicYearId,
      });
      onCreated(created.id);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 me-1" />
        {t('payments.fees.newPeriod.add')}
      </Button>
    );
  }

  return (
    <div
      className="rounded-md border border-border bg-subtle p-3 space-y-3"
      onKeyDown={(e) => {
        // Keep Enter from submitting the fee form around this block.
        if (e.key === 'Enter') {
          e.preventDefault();
          void handleCreate();
        }
      }}
    >
      <Input
        label={t('payments.branchCalendar.fields.label')}
        placeholder={t('payments.branchCalendar.fields.labelPlaceholder')}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={100}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="date"
          label={t('payments.branchCalendar.fields.periodStart')}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          min={yearStart}
          max={yearEnd}
        />
        <Input
          type="date"
          label={t('payments.branchCalendar.fields.periodEnd')}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          min={start || yearStart}
          max={yearEnd}
        />
      </div>
      {error && <p className="text-caption text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={createPeriod.isPending}>
          {createPeriod.isPending ? t('common.loading') : t('payments.fees.newPeriod.create')}
        </Button>
      </div>
    </div>
  );
}

// ─── Create/Edit Fee Dialog ──────────────────────────────────────────────────

function FeeDialog({
  open,
  onOpenChange,
  branchId,
  editingFee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  editingFee: BranchFee | null;
}) {
  const { t, i18n } = useTranslation();
  const createFee = useCreateBranchFee(branchId);
  const updateFee = useUpdateBranchFee(branchId);
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const periodsYearId = activeAcademicYear?.id ?? '';

  const { data: feePeriods, isLoading: feePeriodsLoading, isError: feePeriodsError, error: feePeriodsErrorObj } = useFeePeriods(
    editingFee?.id,
    periodsYearId || undefined,
  );
  // A new fee has no id yet, so list the branch calendar directly; the
  // selection is assigned right after the fee is created.
  const { data: branchPeriods, isLoading: branchPeriodsLoading } = useBranchCalendar(
    editingFee ? undefined : branchId,
    periodsYearId || undefined,
  );
  const setFeePeriods = useSetFeePeriods(editingFee?.id);
  const [selectedPeriodIds, setSelectedPeriodIds] = React.useState<string[]>([]);
  // Set once the fee is created, so a retry after a failed period assignment
  // doesn't create a duplicate fee.
  const [createdFeeId, setCreatedFeeId] = React.useState<string | null>(null);

  // Load the fee's assigned periods once per opening: a later refetch (e.g.
  // after creating a period here) must not wipe ticks that aren't saved yet.
  const periodsInitializedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!editingFee || !feePeriods || periodsInitializedFor.current === editingFee.id) return;
    periodsInitializedFor.current = editingFee.id;
    setSelectedPeriodIds(feePeriods.filter((p) => p.isAssigned).map((p) => p.id));
  }, [feePeriods, editingFee]);

  function togglePeriod(id: string) {
    setSelectedPeriodIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('monthly');
  const [billingDueDay, setBillingDueDay] = React.useState('1');
  const [gracePeriodDays, setGracePeriodDays] = React.useState('5');
  const [showInWizard, setShowInWizard] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const { data: classrooms } = useClassrooms();
  const changeScope = useChangeFeeScope(branchId);
  const [scope, setScope] = React.useState<FeeScope>('none');
  const [scopeClassroomIds, setScopeClassroomIds] = React.useState<string[]>([]);
  // Set when narrowing the scope leaves charges outside it: the dialog then
  // asks whether to cancel them before saving anything.
  const [scopePreview, setScopePreview] = React.useState<ChangeFeeScopeResult | null>(null);

  React.useEffect(() => {
    if (editingFee) {
      setName(editingFee.name);
      setAmount(editingFee.amount);
      setIsRecurring(!!editingFee.billingCycle);
      setBillingCycle(editingFee.billingCycle ?? 'monthly');
      setBillingDueDay(String(editingFee.billingDueDay ?? 1));
      setGracePeriodDays(String(editingFee.gracePeriodDays ?? 5));
      setShowInWizard(editingFee.showInWizard);
      setScope(feeScopeOf(editingFee));
      setScopeClassroomIds((editingFee.classrooms ?? []).map((c) => c.id));
    } else {
      setName('');
      setAmount('');
      setIsRecurring(false);
      setBillingCycle('monthly');
      setBillingDueDay('1');
      setGracePeriodDays('5');
      setShowInWizard(true);
      setSelectedPeriodIds([]);
      setScope('none');
      setScopeClassroomIds([]);
    }
    setCreatedFeeId(null);
    setScopePreview(null);
    setErrors({});
    if (!open) periodsInitializedFor.current = null;
  }, [editingFee, open]);

  function toggleScopeClassroom(id: string) {
    setScopeClassroomIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const linkedIds = new Set((editingFee?.classrooms ?? []).map((c) => c.id));
  const scopeChanged = editingFee
    ? scope !== feeScopeOf(editingFee) ||
      (scope === 'classrooms' &&
        (scopeClassroomIds.length !== linkedIds.size || scopeClassroomIds.some((id) => !linkedIds.has(id))))
    : scope !== 'none';

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length > 100) {
      newErrors.name = t('payments.fees.errors.nameRequired');
    }
    const num = Number(amount);
    if (isNaN(num) || num < 0 || num > 9_999_999.99) {
      newErrors.amount = t('payments.fees.errors.amountInvalid');
    }
    if (isRecurring) {
      const dueDay = Number(billingDueDay);
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
        newErrors.billingDueDay = t('payments.branchConfig.billingDueDayHelper');
      }
      const grace = Number(gracePeriodDays);
      if (!Number.isInteger(grace) || grace < 0 || grace > 60) {
        newErrors.gracePeriodDays = t('payments.branchConfig.gracePeriodHelper');
      }
    }
    if (scope === 'classrooms' && scopeClassroomIds.length === 0) {
      newErrors.scope = t('payments.fees.scope.classroomsRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Narrowing an existing fee to specific classrooms can leave children
    // outside it with charges: preview them and ask before saving anything.
    if (editingFee && scopeChanged && scope === 'classrooms') {
      try {
        const preview = await changeScope.mutateAsync({
          feeId: editingFee.id,
          scope,
          classroomIds: scopeClassroomIds,
          dryRun: true,
        });
        if (preview.periodsToCancel > 0 || preview.paidPeriodsKept > 0) {
          setScopePreview(preview);
          return;
        }
      } catch (err) {
        setErrors((prev) => ({ ...prev, form: err instanceof Error ? err.message : t('common.error') }));
        return;
      }
    }

    await save(false);
  }

  async function save(cancelOutOfScope: boolean) {
    const cycleFields = isRecurring
      ? {
          billingCycle,
          billingDueDay: Number(billingDueDay),
          gracePeriodDays: Number(gracePeriodDays),
        }
      : { billingCycle: null, billingDueDay: null, gracePeriodDays: null };

    try {
      if (editingFee) {
        await updateFee.mutateAsync({
          id: editingFee.id,
          name: name.trim(),
          amount: Number(amount),
          showInWizard,
          ...cycleFields,
        });
        if (periodsSectionActive && periodsYearId) {
          await setFeePeriods.mutateAsync({ academicYearId: periodsYearId, periodIds: selectedPeriodIds });
        }
        if (scopeChanged) {
          await changeScope.mutateAsync({
            feeId: editingFee.id,
            scope,
            classroomIds: scope === 'classrooms' ? scopeClassroomIds : undefined,
            cancelOutOfScope,
          });
        }
      } else {
        let feeId = createdFeeId;
        if (!feeId) {
          const fee = await createFee.mutateAsync({
            name: name.trim(),
            amount: Number(amount),
            showInWizard,
            ...cycleFields,
          });
          feeId = fee.id;
          setCreatedFeeId(feeId);
        }
        if (periodsSectionActive && periodsYearId && selectedPeriodIds.length > 0) {
          await setFeePeriods.mutateAsync({ feeId, academicYearId: periodsYearId, periodIds: selectedPeriodIds });
        }
        if (scope !== 'none') {
          await changeScope.mutateAsync({
            feeId,
            scope,
            classroomIds: scope === 'classrooms' ? scopeClassroomIds : undefined,
          });
        }
      }
      onOpenChange(false);
    } catch (err) {
      setScopePreview(null);
      setErrors((prev) => ({
        ...prev,
        form: err instanceof Error ? err.message : t('common.error'),
      }));
    }
  }

  const periodsSectionActive = isRecurring && billingCycle === 'custom';
  const periodOptions = editingFee ? feePeriods : branchPeriods;
  const periodOptionsLoading = editingFee ? feePeriodsLoading : branchPeriodsLoading;
  const isPending =
    createFee.isPending ||
    updateFee.isPending ||
    setFeePeriods.isPending ||
    changeScope.isPending ||
    (periodsSectionActive && periodOptionsLoading);

  const billingCycleOptions = [
    { value: 'monthly', label: t('payments.branchConfig.cycleMonthly') },
    { value: 'custom', label: t('payments.branchConfig.cycleCustom') },
  ];

  const scopeOptions: { value: FeeScope; label: string; hint: string }[] = [
    { value: 'school', label: t('payments.fees.scope.school'), hint: t('payments.fees.scope.schoolHint') },
    { value: 'classrooms', label: t('payments.fees.scope.classrooms'), hint: t('payments.fees.scope.classroomsHint') },
    { value: 'none', label: t('payments.fees.scope.none'), hint: t('payments.fees.scope.noneHint') },
  ];

  // Confirmation step: narrowing the scope leaves charges outside it.
  if (scopePreview) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('payments.fees.scope.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('payments.fees.scope.confirmDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 bg-subtle rounded-lg p-4">
            {scopePreview.periodsToCancel > 0 && (
              <p className="text-body text-foreground">
                {t('payments.fees.scope.confirmUnpaid', {
                  children: scopePreview.childrenAffected,
                  count: scopePreview.periodsToCancel,
                  amount: formatDZD(Number(scopePreview.amountToCancel), i18n.language),
                })}
              </p>
            )}
            {scopePreview.paidPeriodsKept > 0 && (
              <p className="text-caption text-text-secondary">
                {t('payments.fees.scope.confirmPaidKept', { count: scopePreview.paidPeriodsKept })}
              </p>
            )}
          </div>
          {errors.form && <p className="text-body text-danger">{errors.form}</p>}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setScopePreview(null)} disabled={isPending}>
              {t('common.back')}
            </Button>
            <Button variant="secondary" onClick={() => save(false)} disabled={isPending}>
              {t('payments.fees.scope.keepCharges')}
            </Button>
            {scopePreview.periodsToCancel > 0 && (
              <Button variant="danger" onClick={() => save(true)} disabled={isPending}>
                {isPending ? t('common.loading') : t('payments.fees.scope.cancelCharges')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {editingFee
              ? t('payments.fees.editTitle')
              : t('payments.fees.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('payments.fees.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={t('payments.fees.fields.name')}
            htmlFor="fee-name"
            error={errors.name}
            required
          >
            <Input
              id="fee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('payments.fees.fields.namePlaceholder')}
              maxLength={100}
            />
          </FormField>

          <FormField
            label={t('payments.fees.fields.amount')}
            htmlFor="fee-amount"
            error={errors.amount}
            required
          >
            <Input
              id="fee-amount"
              type="number"
              step="0.01"
              min="0"
              max="9999999.99"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <div className="flex items-center gap-2 py-1">
            <input
              id="fee-recurring"
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="fee-recurring" className="text-body text-foreground cursor-pointer">
              {t('payments.fees.fields.recurring')}
            </label>
          </div>
          <p className="text-caption text-text-secondary -mt-2">
            {t('payments.fees.fields.recurringHelper')}
          </p>

          {isRecurring && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 bg-subtle rounded-lg p-3">
              <FormSelect
                label={t('payments.branchConfig.billingCycle')}
                name="fee-billing-cycle"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                options={billingCycleOptions}
              />

              <FormField
                label={t('payments.branchConfig.billingDueDay')}
                htmlFor="fee-billing-due-day"
                error={errors.billingDueDay}
              >
                <Input
                  id="fee-billing-due-day"
                  type="number"
                  min={1}
                  max={28}
                  step={1}
                  value={billingDueDay}
                  onChange={(e) => setBillingDueDay(e.target.value)}
                />
              </FormField>

              <FormField
                label={t('payments.branchConfig.gracePeriodDays')}
                htmlFor="fee-grace-period"
                error={errors.gracePeriodDays}
              >
                <Input
                  id="fee-grace-period"
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
                />
              </FormField>
            </div>
          )}

          {isRecurring && billingCycle === 'custom' && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-caption text-foreground">
                  {t('payments.fees.fields.customCycleHint')}
                </p>
              </div>

              <div className="ps-7 space-y-3">
                {periodOptionsLoading ? (
                  <div className="animate-pulse h-16 bg-subtle rounded-md" />
                ) : editingFee && feePeriodsError ? (
                  <p className="text-caption text-danger">
                    {feePeriodsErrorObj instanceof Error ? feePeriodsErrorObj.message : t('common.error')}
                  </p>
                ) : !periodOptions || periodOptions.length === 0 ? (
                  <p className="text-caption text-text-secondary">
                    {t('payments.fees.fields.noPeriodsAvailable')}
                  </p>
                ) : (
                  <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                    {periodOptions.map((period) => (
                      <label
                        key={period.id}
                        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-hover"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPeriodIds.includes(period.id)}
                          onChange={() => togglePeriod(period.id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-caption text-foreground">
                          {period.label}
                          <span className="text-text-disabled ms-1">
                            ({new Date(period.periodStart).toLocaleDateString()} –{' '}
                            {new Date(period.periodEnd).toLocaleDateString()})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {periodsYearId && (
                  <NewPeriodForm
                    branchId={branchId}
                    academicYearId={periodsYearId}
                    yearStart={activeAcademicYear?.start_date?.slice(0, 10)}
                    yearEnd={activeAcademicYear?.end_date?.slice(0, 10)}
                    onCreated={(id) => setSelectedPeriodIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 py-1">
            <input
              id="fee-show-in-wizard"
              type="checkbox"
              checked={showInWizard}
              onChange={(e) => setShowInWizard(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="fee-show-in-wizard" className="text-body text-foreground cursor-pointer">
              {t('payments.fees.fields.showInWizard')}
            </label>
          </div>
          <p className="text-caption text-text-secondary -mt-2">
            {t('payments.fees.fields.showInWizardHint')}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-label font-medium text-foreground mb-1">
              {t('payments.fees.fields.scope')}
            </legend>
            {scopeOptions.map((opt) => (
              <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="fee-scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  className="w-4 h-4 mt-0.5 border-border text-primary focus:ring-primary"
                />
                <span>
                  <span className="block text-body text-foreground">{opt.label}</span>
                  <span className="block text-caption text-text-secondary">{opt.hint}</span>
                </span>
              </label>
            ))}
            {scope === 'classrooms' && (
              <div className="ps-6 space-y-1">
                <div className="border border-border rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                  {(classrooms ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-hover">
                      <input
                        type="checkbox"
                        checked={scopeClassroomIds.includes(c.id)}
                        onChange={() => toggleScopeClassroom(c.id)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-caption text-foreground">{c.name}</span>
                    </label>
                  ))}
                  {(classrooms ?? []).length === 0 && (
                    <p className="text-caption text-text-secondary p-2">
                      {t('payments.fees.fields.noClassroomsAvailable')}
                    </p>
                  )}
                </div>
              </div>
            )}
            {errors.scope && <p className="text-caption text-danger">{errors.scope}</p>}
          </fieldset>

          {errors.form && (
            <p className="text-body text-danger">{errors.form}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── View Fee Dialog ─────────────────────────────────────────────────────────

function InfoRow({ label, value, dir }: { label: string; value: React.ReactNode; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="text-body font-medium text-foreground" dir={dir}>
        {value}
      </span>
    </div>
  );
}

function ViewFeeDialog({
  open,
  onOpenChange,
  fee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: BranchFee | null;
}) {
  const { t, i18n } = useTranslation();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const periodsYearId = activeAcademicYear?.id ?? '';

  const showPeriods = fee?.billingCycle === 'custom';

  const { data: feePeriods, isLoading: feePeriodsLoading } = useFeePeriods(
    showPeriods ? fee?.id : undefined,
    showPeriods ? periodsYearId || undefined : undefined,
  );
  const assignedPeriods = (feePeriods ?? []).filter((p) => p.isAssigned);

  const { data: feeClassrooms, isLoading: feeClassroomsLoading } = useFeeClassrooms(fee?.id);
  const linkedClassrooms = (feeClassrooms ?? []).filter((c) => c.isLinked);

  if (!fee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('payments.fees.view.title', { name: fee.name })}</DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          <InfoRow label={t('payments.fees.fields.name')} value={fee.name} />
          <InfoRow
            label={t('payments.fees.fields.amount')}
            value={formatDZD(Number(fee.amount), i18n.language)}
            dir="ltr"
          />
          <InfoRow
            label={t('payments.fees.fields.recurring')}
            value={
              fee.billingCycle
                ? t(`payments.branchConfig.cycle${fee.billingCycle.charAt(0).toUpperCase()}${fee.billingCycle.slice(1)}`)
                : t('payments.fees.oneShot')
            }
          />
          {fee.billingCycle && (
            <>
              <InfoRow label={t('payments.branchConfig.billingDueDay')} value={fee.billingDueDay} />
              <InfoRow label={t('payments.branchConfig.gracePeriodDays')} value={fee.gracePeriodDays} />
            </>
          )}
        </div>

        {showPeriods && (
          <div className="space-y-3 pt-1">
            {feePeriodsLoading ? (
              <div className="animate-pulse h-12 bg-subtle rounded-md" />
            ) : assignedPeriods.length === 0 ? (
              <p className="text-caption text-text-secondary">{t('payments.fees.view.noAssignedPeriods')}</p>
            ) : (
              <ul className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                {assignedPeriods.map((period) => (
                  <li key={period.id} className="p-2 text-caption text-foreground">
                    {period.label}
                    <span className="text-text-disabled ms-1">
                      ({new Date(period.periodStart).toLocaleDateString()} –{' '}
                      {new Date(period.periodEnd).toLocaleDateString()})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-3 pt-1 border-t border-border">
          <p className="text-caption font-medium text-foreground pt-2">
            {t('payments.fees.fields.scope')}
          </p>
          {fee.appliesToSchool ? (
            <p className="text-caption text-foreground">{t('payments.fees.view.appliesToSchool')}</p>
          ) : feeClassroomsLoading ? (
            <div className="animate-pulse h-12 bg-subtle rounded-md" />
          ) : linkedClassrooms.length === 0 ? (
            <p className="text-caption text-text-secondary">{t('payments.fees.scope.noneHint')}</p>
          ) : (
            <ul className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
              {linkedClassrooms.map((classroom) => (
                <li key={classroom.id} className="p-2 text-caption text-foreground">
                  {classroom.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Fee Dialog ───────────────────────────────────────────────────────

function AssignFeeDialog({
  open,
  onOpenChange,
  branchId,
  fee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  fee: BranchFee | null;
}) {
  const { t } = useTranslation();
  const assignFee = useAssignFee(branchId);
  const { data: childrenData } = useChildren({ pageSize: 100 });
  const { data: classrooms } = useClassrooms();

  const [targetType, setTargetType] = React.useState<'children' | 'classrooms' | 'school'>('school');
  const [selectedChildIds, setSelectedChildIds] = React.useState<string[]>([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = React.useState<string[]>([]);
  const [childSearch, setChildSearch] = React.useState('');
  const [result, setResult] = React.useState<AssignFeeResult | null>(null);
  const [assignError, setAssignError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTargetType('school');
      setSelectedChildIds([]);
      setSelectedClassroomIds([]);
      setChildSearch('');
      setResult(null);
      setAssignError(null);
    }
  }, [open]);

  async function handleAssign() {
    if (!fee) return;
    setAssignError(null);

    try {
      const res = await assignFee.mutateAsync({
        feeId: fee.id,
        target: targetType,
        childIds: targetType === 'children' ? selectedChildIds : undefined,
        classroomIds: targetType === 'classrooms' ? selectedClassroomIds : undefined,
      });
      setResult(res);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const childOptions = (childrenData?.children ?? []).map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const filteredChildOptions = React.useMemo(() => {
    if (!childSearch.trim()) return childOptions;
    const query = childSearch.toLowerCase().trim();
    return childOptions.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [childOptions, childSearch]);

  const classroomOptions = (classrooms ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const targetOptions = [
    { value: 'school', label: t('payments.fees.assign.targetSchool') },
    { value: 'classrooms', label: t('payments.fees.assign.targetClassrooms') },
    { value: 'children', label: t('payments.fees.assign.targetChildren') },
  ];

  // A whole-school fee already reaches every classroom; narrowing it is a
  // scope change made from the edit dialog.
  const classroomsBlocked = targetType === 'classrooms' && !!fee?.appliesToSchool;

  const canSubmit =
    targetType === 'school' ||
    (targetType === 'children' && selectedChildIds.length > 0) ||
    (targetType === 'classrooms' && selectedClassroomIds.length > 0 && !classroomsBlocked);

  // Success view
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('payments.fees.assign.resultTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 bg-subtle rounded-lg p-4">
            <p className="text-body text-foreground">
              {t('payments.fees.assign.resultApplied', { count: result.applied })}
            </p>
            {result.skipped > 0 && (
              <div className="text-caption text-text-secondary">
                <p>{t('payments.fees.assign.resultSkipped', { count: result.skipped })}</p>
                {result.skippedChildren?.length > 0 && (
                  <p className="text-text-disabled">
                    {result.skippedChildren.slice(0, 10).map((c) => c.name).join(', ')}
                    {result.skippedChildren.length > 10 &&
                      ` ${t('payments.fees.assign.andMore', { count: result.skippedChildren.length - 10 })}`}
                  </p>
                )}
              </div>
            )}
            {result.enrolled > 0 && (
              <p className="text-caption text-text-secondary">
                {t('payments.fees.assign.resultEnrolled', { count: result.enrolled })}
              </p>
            )}
            {result.yearEnded > 0 && (
              <p className="text-caption text-text-secondary">
                {t('payments.fees.assign.resultYearEnded', { count: result.yearEnded })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('payments.fees.assign.title', { name: fee?.name })}</DialogTitle>
          <DialogDescription>{t('payments.fees.assign.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormSelect
            label={t('payments.fees.assign.targetLabel')}
            name="targetType"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as 'children' | 'classrooms' | 'school')}
            options={targetOptions}
          />

          {targetType === 'children' && (
            <div className="space-y-2">
              <label className="text-label font-medium text-foreground">
                {t('payments.fees.assign.selectChildren')}
              </label>
              <Input
                type="text"
                placeholder={t('payments.fees.assign.searchPlaceholder')}
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {filteredChildOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChildIds.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChildIds((prev) => [...prev, opt.value]);
                        } else {
                          setSelectedChildIds((prev) => prev.filter((id) => id !== opt.value));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-body text-foreground">{opt.label}</span>
                  </label>
                ))}
                {filteredChildOptions.length === 0 && (
                  <p className="text-caption text-text-secondary p-2">{t('payments.fees.assign.noChildren')}</p>
                )}
              </div>
              {selectedChildIds.length > 0 && (
                <p className="text-caption text-text-secondary">
                  {t('payments.fees.assign.selectedCount', { count: selectedChildIds.length })}
                </p>
              )}
            </div>
          )}

          {classroomsBlocked && (
            <p className="text-body text-warning bg-subtle rounded-lg p-3">
              {t('payments.fees.assign.schoolScopeConflict')}
            </p>
          )}

          {targetType === 'classrooms' && !classroomsBlocked && (
            <div className="space-y-2">
              <label className="text-label font-medium text-foreground">
                {t('payments.fees.assign.selectClassrooms')}
              </label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {classroomOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedClassroomIds.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClassroomIds((prev) => [...prev, opt.value]);
                        } else {
                          setSelectedClassroomIds((prev) => prev.filter((id) => id !== opt.value));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-body text-foreground">{opt.label}</span>
                  </label>
                ))}
                {classroomOptions.length === 0 && (
                  <p className="text-caption text-text-secondary p-2">{t('payments.fees.assign.noClassrooms')}</p>
                )}
              </div>
            </div>
          )}

          {targetType === 'school' && (
            <p className="text-body text-text-secondary bg-subtle rounded-lg p-3">
              {t('payments.fees.assign.schoolConfirmation')}
            </p>
          )}

          {assignError && (
            <p className="text-body text-danger">{assignError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAssign} disabled={!canSubmit || assignFee.isPending}>
            {assignFee.isPending ? t('common.loading') : t('payments.fees.assign.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BranchFeesPage() {
  const { t, i18n } = useTranslation();
  const { branchId: selectedBranchId } = useDefaultBranch();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
  const [editingFee, setEditingFee] = React.useState<BranchFee | null>(null);
  const [assigningFee, setAssigningFee] = React.useState<BranchFee | null>(null);
  const [viewingFee, setViewingFee] = React.useState<BranchFee | null>(null);

  const { data: fees, isLoading } = useBranchFees(selectedBranchId);
  const deleteFee = useDeleteBranchFee(selectedBranchId);

  function handleView(fee: BranchFee) {
    setViewingFee(fee);
    setViewDialogOpen(true);
  }

  function handleEdit(fee: BranchFee) {
    setEditingFee(fee);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingFee(null);
    setDialogOpen(true);
  }

  function handleAssign(fee: BranchFee) {
    setAssigningFee(fee);
    setAssignDialogOpen(true);
  }

  async function handleDelete(fee: BranchFee) {
    if (window.confirm(t('payments.fees.confirmDelete', { name: fee.name }))) {
      await deleteFee.mutateAsync(fee.id);
    }
  }

  const columns: Column<BranchFee>[] = [
    {
      key: 'name',
      header: t('payments.fees.fields.name'),
      render: (fee) => (
        <span className="font-medium text-foreground">{fee.name}</span>
      ),
    },
    {
      key: 'amount',
      header: t('payments.fees.fields.amount'),
      render: (fee) => (
        <span className="font-medium text-foreground" dir="ltr">
          {formatDZD(Number(fee.amount), i18n.language)}
        </span>
      ),
    },
    {
      key: 'cycle',
      header: t('payments.fees.fields.recurring'),
      render: (fee) =>
        fee.billingCycle ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-muted text-accent text-caption font-medium">
            {t(`payments.branchConfig.cycle${fee.billingCycle.charAt(0).toUpperCase()}${fee.billingCycle.slice(1)}`)}
          </span>
        ) : (
          <span className="text-caption text-text-disabled">{t('payments.fees.oneShot')}</span>
        ),
    },
    {
      key: 'scope',
      header: t('payments.fees.fields.scope'),
      render: (fee) => {
        if (fee.appliesToSchool) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-caption font-medium">
              {t('payments.fees.scopeSchool')}
            </span>
          );
        }
        const classrooms = fee.classrooms ?? [];
        if (classrooms.length === 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-subtle text-text-secondary text-caption font-medium">
              {t('payments.fees.scopeGeneral')}
            </span>
          );
        }
        const names = classrooms.map((c) => c.name).join(', ');
        return (
          <span className="text-caption text-foreground truncate max-w-[180px] block" title={names}>
            {names}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (fee) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleView(fee)} title={t('payments.fees.view.button')}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleAssign(fee)} title={t('payments.fees.assign.button')}>
            <Users className="w-4 h-4 text-primary" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(fee)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(fee)}
            disabled={deleteFee.isPending}
          >
            <Trash2 className="w-4 h-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="text-heading-md font-semibold text-foreground">
            {t('payments.fees.title')}
          </h1>
        </div>
        <CreateButton
          label={t('payments.fees.create')}
          onClick={handleCreate}
          disabled={!selectedBranchId}
        />
      </div>

      {/* Fees table */}
      <DataTable
        columns={columns}
        data={fees ?? []}
        keyExtractor={(f) => f.id}
        emptyMessage={isLoading ? t('common.loading') : t('payments.fees.empty')}
      />

      {/* Create/Edit Dialog */}
      {selectedBranchId && (
        <FeeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          branchId={selectedBranchId}
          editingFee={editingFee}
        />
      )}

      {/* Assign Fee Dialog */}
      {selectedBranchId && (
        <AssignFeeDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          branchId={selectedBranchId}
          fee={assigningFee}
        />
      )}

      {/* View Fee Dialog */}
      <ViewFeeDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} fee={viewingFee} />
    </div>
  );
}
