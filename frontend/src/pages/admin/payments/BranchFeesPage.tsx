import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Edit2, Eye, DollarSign, Users, CalendarDays } from 'lucide-react';
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
import { useFeeClassrooms, useSetFeeClassrooms } from '@/hooks/useBranchFeeClassrooms';
import {
  useBranchFees,
  useCreateBranchFee,
  useUpdateBranchFee,
  useDeleteBranchFee,
  useAssignFee,
  type BranchFee,
  type BillingCycle,
  type AssignFeeResult,
} from '@/hooks/useBranchFees';

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
  const { t } = useTranslation();
  const createFee = useCreateBranchFee(branchId);
  const updateFee = useUpdateBranchFee(branchId);
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const periodsYearId = activeAcademicYear?.id ?? '';

  const { data: feePeriods, isLoading: feePeriodsLoading, isError: feePeriodsError, error: feePeriodsErrorObj } = useFeePeriods(
    editingFee?.id,
    periodsYearId || undefined,
  );
  const setFeePeriods = useSetFeePeriods(editingFee?.id);
  const [selectedPeriodIds, setSelectedPeriodIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setSelectedPeriodIds((feePeriods ?? []).filter((p) => p.isAssigned).map((p) => p.id));
  }, [feePeriods]);

  function togglePeriod(id: string) {
    setSelectedPeriodIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const {
    data: feeClassrooms,
    isLoading: feeClassroomsLoading,
    isError: feeClassroomsError,
    error: feeClassroomsErrorObj,
  } = useFeeClassrooms(editingFee?.id);
  const setFeeClassrooms = useSetFeeClassrooms(editingFee?.id);
  const [selectedClassroomIds, setSelectedClassroomIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setSelectedClassroomIds((feeClassrooms ?? []).filter((c) => c.isLinked).map((c) => c.id));
  }, [feeClassrooms]);

  function toggleClassroom(id: string) {
    setSelectedClassroomIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('monthly');
  const [billingDueDay, setBillingDueDay] = React.useState('1');
  const [gracePeriodDays, setGracePeriodDays] = React.useState('5');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (editingFee) {
      setName(editingFee.name);
      setAmount(editingFee.amount);
      setIsRecurring(!!editingFee.billingCycle);
      setBillingCycle(editingFee.billingCycle ?? 'monthly');
      setBillingDueDay(String(editingFee.billingDueDay ?? 1));
      setGracePeriodDays(String(editingFee.gracePeriodDays ?? 5));
    } else {
      setName('');
      setAmount('');
      setIsRecurring(false);
      setBillingCycle('monthly');
      setBillingDueDay('1');
      setGracePeriodDays('5');
    }
    setErrors({});
  }, [editingFee, open]);

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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

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
          ...cycleFields,
        });
        if (periodsSectionActive && periodsYearId) {
          await setFeePeriods.mutateAsync({ academicYearId: periodsYearId, periodIds: selectedPeriodIds });
        }
        await setFeeClassrooms.mutateAsync(selectedClassroomIds);
      } else {
        await createFee.mutateAsync({
          name: name.trim(),
          amount: Number(amount),
          ...cycleFields,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        form: err instanceof Error ? err.message : t('common.error'),
      }));
    }
  }

  const periodsSectionActive = !!editingFee && isRecurring && billingCycle === 'custom';
  const isPending =
    createFee.isPending ||
    updateFee.isPending ||
    setFeePeriods.isPending ||
    setFeeClassrooms.isPending ||
    (periodsSectionActive && feePeriodsLoading) ||
    (!!editingFee && feeClassroomsLoading);

  const billingCycleOptions = [
    { value: 'monthly', label: t('payments.branchConfig.cycleMonthly') },
    { value: 'custom', label: t('payments.branchConfig.cycleCustom') },
  ];

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

              {!editingFee ? (
                <p className="text-caption text-text-secondary ps-7">
                  {t('payments.fees.fields.savePeriodsFirst')}
                </p>
              ) : (
                <div className="ps-7 space-y-3">
                  {feePeriodsLoading ? (
                    <div className="animate-pulse h-16 bg-subtle rounded-md" />
                  ) : feePeriodsError ? (
                    <p className="text-caption text-danger">
                      {feePeriodsErrorObj instanceof Error ? feePeriodsErrorObj.message : t('common.error')}
                    </p>
                  ) : !feePeriods || feePeriods.length === 0 ? (
                    <p className="text-caption text-text-secondary">
                      {t('payments.fees.fields.noPeriodsAvailable')}
                    </p>
                  ) : (
                    <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                      {feePeriods.map((period) => (
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
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-caption font-medium text-foreground">
              {t('payments.fees.fields.classes')}
            </p>
            <p className="text-caption text-text-secondary -mt-2">
              {t('payments.fees.fields.classesHint')}
            </p>

            {!editingFee ? (
              <p className="text-caption text-text-secondary">
                {t('payments.fees.fields.saveClassesFirst')}
              </p>
            ) : feeClassroomsLoading ? (
              <div className="animate-pulse h-16 bg-subtle rounded-md" />
            ) : feeClassroomsError ? (
              <p className="text-caption text-danger">
                {feeClassroomsErrorObj instanceof Error ? feeClassroomsErrorObj.message : t('common.error')}
              </p>
            ) : !feeClassrooms || feeClassrooms.length === 0 ? (
              <p className="text-caption text-text-secondary">
                {t('payments.fees.fields.noClassroomsAvailable')}
              </p>
            ) : (
              <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                {feeClassrooms.map((classroom) => (
                  <label
                    key={classroom.id}
                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-hover"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassroomIds.includes(classroom.id)}
                      onChange={() => toggleClassroom(classroom.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-caption text-foreground">{classroom.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

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
            {t('payments.fees.view.classesTitle')}
          </p>
          {feeClassroomsLoading ? (
            <div className="animate-pulse h-12 bg-subtle rounded-md" />
          ) : linkedClassrooms.length === 0 ? (
            <p className="text-caption text-text-secondary">{t('payments.fees.view.noLinkedClassrooms')}</p>
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

  const canSubmit =
    targetType === 'school' ||
    (targetType === 'children' && selectedChildIds.length > 0) ||
    (targetType === 'classrooms' && selectedClassroomIds.length > 0);

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
              <p className="text-caption text-text-secondary">
                {t('payments.fees.assign.resultSkipped', { count: result.skipped })}
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

          {targetType === 'classrooms' && (
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
