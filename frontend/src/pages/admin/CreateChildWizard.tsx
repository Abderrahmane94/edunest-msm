import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { cn } from '@/lib/utils';
import { formatDZD } from '@/lib/formatters';
import {
  useCreateChild, useLinkParent, useEnrollChild, type Child, type BloodType,
} from '@/hooks/useChildren';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useUsers } from '@/hooks/useUsers';
import { useCreateUser } from './InviteUserDialog';
import { useClassrooms } from '@/hooks/useClassrooms';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useBranchFees, useApplyFee, type BranchFee } from '@/hooks/useBranchFees';
import { useClassroomFees } from '@/hooks/useBranchFeeClassrooms';
import { useCreateEnrollment } from '@/hooks/useEnrollments';
import { useChildBillingPeriods, useRecordPayment } from '@/hooks/usePayments';
import { suggestAllocations, totalOutstanding } from '@/lib/paymentAllocation';
import { EmergencyContactsManager } from './EmergencyContactsDialog';
import { MedicalNotesManager } from './MedicalNotesDialog';

/** Minimal shape needed once the child exists. */
type ChildRef = Pick<Child, 'id' | 'first_name' | 'last_name'>;

const STEPS = ['basics', 'parent', 'emergency', 'medical', 'classroom', 'fees'] as const;
type Step = (typeof STEPS)[number];

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Clamps a date (YYYY-MM-DD) into an academic year's range. The child's
 * registration date (step 1) may fall before the school year technically
 * starts (or, rarely, after it ends) — the payments enrollment's start_date
 * must be within that range, so it's clamped rather than sent as-is.
 */
function clampToAcademicYear(date: string, startDate: string, endDate: string): string {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  if (date < start) return start;
  if (date > end) return end;
  return date;
}

// ─── Step 1: Basic info ──────────────────────────────────────────────────────

function BasicsStep({
  onCreated,
  onCancel,
}: {
  onCreated: (child: ChildRef, enrollmentDate: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const createChild = useCreateChild();
  const { data: activeYear } = useActiveAcademicYear();
  const today = todayString();
  const emptyForm = {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'male',
    enrollment_date: today,
    national_id: '',
    address: '',
    place_of_birth: '',
    blood_type: '' as BloodType | '',
  };
  const [formData, setFormData] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = t('children.form.firstNameRequired');
    if (!formData.last_name.trim()) newErrors.last_name = t('children.form.lastNameRequired');
    if (!formData.date_of_birth) newErrors.date_of_birth = t('children.form.dobRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!activeYear) {
      setErrors({ form: t('children.form.noActiveYear') });
      return;
    }

    const { first_name, last_name } = formData;
    try {
      const result = await createChild.mutateAsync({
        first_name,
        last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        enrollment_date: formData.enrollment_date,
        academic_year_id: activeYear.id,
        national_id: formData.national_id.trim() || undefined,
        address: formData.address.trim() || undefined,
        place_of_birth: formData.place_of_birth.trim() || undefined,
        blood_type: formData.blood_type || undefined,
      });
      const newId = (result as { id?: string } | undefined)?.id;
      if (newId) onCreated({ id: newId, first_name, last_name }, formData.enrollment_date);
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: err instanceof Error ? err.message : t('common.error') }));
    }
  }

  const genderOptions = [
    { value: 'male', label: t('children.form.male') },
    { value: 'female', label: t('children.form.female') },
  ];

  const bloodTypeOptions = [
    { value: 'a_positive', label: t('children.form.bloodTypes.a_positive') },
    { value: 'a_negative', label: t('children.form.bloodTypes.a_negative') },
    { value: 'b_positive', label: t('children.form.bloodTypes.b_positive') },
    { value: 'b_negative', label: t('children.form.bloodTypes.b_negative') },
    { value: 'ab_positive', label: t('children.form.bloodTypes.ab_positive') },
    { value: 'ab_negative', label: t('children.form.bloodTypes.ab_negative') },
    { value: 'o_positive', label: t('children.form.bloodTypes.o_positive') },
    { value: 'o_negative', label: t('children.form.bloodTypes.o_negative') },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label={t('children.form.firstName')} htmlFor="wz-first-name" error={errors.first_name} required>
          <Input
            id="wz-first-name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            placeholder={t('children.form.firstNamePlaceholder')}
          />
        </FormField>
        <FormField label={t('children.form.lastName')} htmlFor="wz-last-name" error={errors.last_name} required>
          <Input
            id="wz-last-name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            placeholder={t('children.form.lastNamePlaceholder')}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label={t('children.form.dateOfBirth')} htmlFor="wz-dob" error={errors.date_of_birth} required>
          <Input id="wz-dob" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} />
        </FormField>
        <FormSelect
          label={t('children.form.gender')}
          name="gender"
          value={formData.gender}
          onChange={handleSelectChange}
          options={genderOptions}
        />
      </div>

      <FormField label={t('children.form.enrollmentDate')} htmlFor="wz-enrollment-date" required>
        <Input
          id="wz-enrollment-date"
          name="enrollment_date"
          type="date"
          value={formData.enrollment_date}
          onChange={handleChange}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label={t('children.form.nationalId')} htmlFor="wz-national-id">
          <Input
            id="wz-national-id"
            name="national_id"
            value={formData.national_id}
            onChange={handleChange}
            placeholder={t('children.form.nationalIdPlaceholder')}
          />
        </FormField>
        <FormField label={t('children.form.placeOfBirth')} htmlFor="wz-place-of-birth">
          <Input
            id="wz-place-of-birth"
            name="place_of_birth"
            value={formData.place_of_birth}
            onChange={handleChange}
            placeholder={t('children.form.placeOfBirthPlaceholder')}
          />
        </FormField>
      </div>

      <FormField label={t('children.form.address')} htmlFor="wz-address">
        <Input
          id="wz-address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder={t('children.form.addressPlaceholder')}
        />
      </FormField>

      <FormSelect
        label={t('children.form.bloodType')}
        name="blood_type"
        value={formData.blood_type}
        onChange={handleSelectChange}
        options={bloodTypeOptions}
        placeholder={t('children.form.selectBloodType')}
      />

      {errors.form && <p className="text-body text-danger mt-1">{errors.form}</p>}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={createChild.isPending}>
          {createChild.isPending ? t('common.loading') : t('children.wizard.next')}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Step 2: Parent ──────────────────────────────────────────────────────────

function ParentStep({
  childId,
  onBack,
  onNext,
}: {
  childId: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const linkParent = useLinkParent();
  const createUser = useCreateUser();
  const { data: usersData } = useUsers({ pageSize: 100 });
  const parents = (usersData?.users ?? []).filter((u) => u.role === 'parent');

  const [mode, setMode] = React.useState<'existing' | 'new'>('existing');
  const [parentId, setParentId] = React.useState('');
  const [relationship, setRelationship] = React.useState('mother');
  const [newParent, setNewParent] = React.useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const parentOptions = parents.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }));
  const relationshipOptions = [
    { value: 'mother', label: t('children.linkParent.mother') },
    { value: 'father', label: t('children.linkParent.father') },
    { value: 'guardian', label: t('children.linkParent.guardian') },
  ];

  async function handleNext() {
    setError(null);

    try {
      if (mode === 'existing' && parentId) {
        setIsSaving(true);
        await linkParent.mutateAsync({ childId, parentId, relationship });
      } else if (mode === 'new' && (newParent.firstName.trim() || newParent.lastName.trim() || newParent.email.trim())) {
        if (!newParent.firstName.trim() || !newParent.lastName.trim() || !newParent.email.trim()) {
          setError(t('children.wizard.parent.newParentIncomplete'));
          return;
        }
        setIsSaving(true);
        const created = await createUser.mutateAsync({
          firstName: newParent.firstName.trim(),
          lastName: newParent.lastName.trim(),
          email: newParent.email.trim(),
          phone: newParent.phone.trim() || undefined,
          role: 'parent',
          preferredLanguage: 'fr',
        });
        const newParentId = (created as { id?: string } | undefined)?.id;
        if (newParentId) {
          await linkParent.mutateAsync({ childId, parentId: newParentId, relationship });
        }
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-text-secondary">{t('children.wizard.parent.description')}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'existing' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('existing')}
        >
          {t('children.wizard.parent.selectExisting')}
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('new')}
        >
          <UserPlus className="w-4 h-4" />
          {t('children.wizard.parent.createNew')}
        </Button>
      </div>

      {mode === 'existing' ? (
        <>
          <FormSelect
            label={t('children.linkParent.parent')}
            name="parent_id"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={parentOptions}
            placeholder={t('children.linkParent.selectParent')}
          />
          <FormSelect
            label={t('children.linkParent.relationship')}
            name="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            options={relationshipOptions}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('users.invite_form.firstName')} htmlFor="wz-parent-first">
              <Input
                id="wz-parent-first"
                value={newParent.firstName}
                onChange={(e) => setNewParent((p) => ({ ...p, firstName: e.target.value }))}
              />
            </FormField>
            <FormField label={t('users.invite_form.lastName')} htmlFor="wz-parent-last">
              <Input
                id="wz-parent-last"
                value={newParent.lastName}
                onChange={(e) => setNewParent((p) => ({ ...p, lastName: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label={t('users.invite_form.email')} htmlFor="wz-parent-email">
            <Input
              id="wz-parent-email"
              type="email"
              value={newParent.email}
              onChange={(e) => setNewParent((p) => ({ ...p, email: e.target.value }))}
            />
          </FormField>
          <FormField label={t('users.invite_form.phone')} htmlFor="wz-parent-phone">
            <Input
              id="wz-parent-phone"
              type="tel"
              value={newParent.phone}
              onChange={(e) => setNewParent((p) => ({ ...p, phone: e.target.value }))}
            />
          </FormField>
          <FormSelect
            label={t('children.linkParent.relationship')}
            name="relationship-new"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            options={relationshipOptions}
          />
        </>
      )}

      {error && <p className="text-body text-danger">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('children.wizard.back')}
        </Button>
        <Button type="button" onClick={handleNext} disabled={isSaving}>
          {isSaving ? t('common.loading') : t('children.wizard.next')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Step 5: Classroom ───────────────────────────────────────────────────────

function ClassroomStep({
  childId,
  classroomId,
  onClassroomChange,
  onBack,
  onNext,
}: {
  childId: string;
  classroomId: string;
  onClassroomChange: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const { data: activeYear } = useActiveAcademicYear();
  const { data: classrooms } = useClassrooms(activeYear?.id);
  const enrollChild = useEnrollChild();
  const [error, setError] = React.useState<string | null>(null);

  const classroomOptions = (classrooms ?? []).map((c) => ({ value: c.id, label: c.name }));

  async function handleNext() {
    setError(null);
    if (!classroomId) {
      onNext();
      return;
    }
    try {
      await enrollChild.mutateAsync({ childId, classroomId });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-text-secondary">{t('children.wizard.classroom.description')}</p>

      <FormSelect
        label={t('children.detail.classroom')}
        name="classroom_id"
        value={classroomId}
        onChange={(e) => onClassroomChange(e.target.value)}
        options={classroomOptions}
        placeholder={t('children.wizard.classroom.selectPlaceholder')}
      />

      {error && <p className="text-body text-danger">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('children.wizard.back')}
        </Button>
        <Button type="button" onClick={handleNext} disabled={enrollChild.isPending}>
          {enrollChild.isPending ? t('common.loading') : t('children.wizard.next')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Step 6: Fees & payment ──────────────────────────────────────────────────

function FeesStep({
  child,
  classroomId,
  enrollmentDate,
  onBack,
  onFinish,
}: {
  child: ChildRef;
  classroomId: string;
  enrollmentDate: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { branchId } = useDefaultBranch();
  const { data: activeYear } = useActiveAcademicYear();
  const { data: classroomFees } = useClassroomFees(classroomId || undefined);
  const { data: branchFees } = useBranchFees(branchId);
  const fees: BranchFee[] = classroomId ? (classroomFees ?? []) : (branchFees ?? []);
  const recurringFees = fees.filter((f) => !!f.billingCycle);
  const oneShotFees = fees.filter((f) => !f.billingCycle);

  const createEnrollment = useCreateEnrollment();
  const applyFee = useApplyFee();
  const recordPayment = useRecordPayment(branchId);

  const [baseFeeId, setBaseFeeId] = React.useState('');
  const [extraFeeIds, setExtraFeeIds] = React.useState<string[]>([]);
  const [enrollmentCreated, setEnrollmentCreated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [paymentMode, setPaymentMode] = React.useState<'full' | 'partial' | 'later' | null>(null);
  const [partialAmount, setPartialAmount] = React.useState('');

  const { data: billingPeriods } = useChildBillingPeriods(enrollmentCreated ? child.id : '');
  const outstanding = totalOutstanding(billingPeriods ?? []);

  function toggleExtraFee(id: string) {
    setExtraFeeIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function handleCreateEnrollment() {
    if (!baseFeeId) return;
    setError(null);
    setIsSaving(true);
    try {
      const startDate = activeYear
        ? clampToAcademicYear(enrollmentDate, activeYear.start_date, activeYear.end_date)
        : enrollmentDate;
      const result = await createEnrollment.mutateAsync({
        childId: child.id,
        branchId,
        academicYearId: activeYear?.id ?? '',
        baseFeeId,
        startDate,
      });
      for (const feeId of extraFeeIds) {
        await applyFee.mutateAsync({ enrollmentId: result.enrollmentId, branchFeeId: feeId });
      }
      await qc.invalidateQueries({ queryKey: ['child-billing-periods', child.id] });
      setEnrollmentCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRecordPayment(amount: number) {
    setError(null);
    setIsSaving(true);
    try {
      const allocations = suggestAllocations(billingPeriods ?? [], amount);
      await recordPayment.mutateAsync({
        childId: child.id,
        totalAmount: amount,
        channel: 'cash',
        valueDate: todayString(),
        allocations: allocations.map((a) => ({ billingPeriodId: a.billingPeriodId, amount: Number(a.amount) })),
      });
      onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  const baseFeeOptions = recurringFees.map((f) => ({
    value: f.id,
    label: `${f.name} (${formatDZD(Number(f.amount), i18n.language)})`,
  }));

  return (
    <div className="space-y-4">
      {!enrollmentCreated ? (
        <>
          <p className="text-body text-text-secondary">{t('children.wizard.fees.description')}</p>

          <FormSelect
            label={t('payments.enrollments.form.baseFee')}
            name="base_fee_id"
            value={baseFeeId}
            onChange={(e) => setBaseFeeId(e.target.value)}
            options={baseFeeOptions}
            placeholder={t('payments.enrollments.form.selectBaseFee')}
            helperText={recurringFees.length === 0 ? t('payments.enrollments.form.noRecurringFees') : undefined}
          />

          {oneShotFees.length > 0 && (
            <div className="space-y-2">
              <p className="text-label font-medium text-foreground">{t('children.wizard.fees.extraFees')}</p>
              <div className="border border-border rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                {oneShotFees.map((fee) => (
                  <label key={fee.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={extraFeeIds.includes(fee.id)}
                      onChange={() => toggleExtraFee(fee.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-caption text-foreground">
                      {fee.name} ({formatDZD(Number(fee.amount), i18n.language)})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-body text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onBack}>
              {t('children.wizard.back')}
            </Button>
            <Button type="button" variant="secondary" onClick={onFinish}>
              {t('children.wizard.fees.skipEnrollment')}
            </Button>
            <Button type="button" onClick={handleCreateEnrollment} disabled={!baseFeeId || isSaving}>
              {isSaving ? t('common.loading') : t('children.wizard.next')}
            </Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <p className="text-body text-text-secondary">
            {t('children.wizard.fees.paymentPrompt', { amount: formatDZD(outstanding, i18n.language) })}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={paymentMode === 'full' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setPaymentMode('full')}
            >
              {t('children.wizard.fees.payFull')}
            </Button>
            <Button
              type="button"
              variant={paymentMode === 'partial' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setPaymentMode('partial')}
            >
              {t('children.wizard.fees.payPartial')}
            </Button>
            <Button
              type="button"
              variant={paymentMode === 'later' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setPaymentMode('later')}
            >
              {t('children.wizard.fees.payLater')}
            </Button>
          </div>

          {paymentMode === 'partial' && (
            <FormField label={t('payments.recording.fields.totalAmount')} htmlFor="wz-partial-amount">
              <Input
                id="wz-partial-amount"
                type="number"
                min="0"
                step="0.01"
                max={outstanding}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </FormField>
          )}

          {error && <p className="text-body text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onBack}>
              {t('children.wizard.back')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (paymentMode === 'full') handleRecordPayment(outstanding);
                else if (paymentMode === 'partial') handleRecordPayment(Number(partialAmount) || 0);
                else onFinish();
              }}
              disabled={isSaving || (paymentMode === 'partial' && (!partialAmount || Number(partialAmount) <= 0))}
            >
              {isSaving ? t('common.loading') : t('children.wizard.finish')}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}

// ─── Wizard shell ────────────────────────────────────────────────────────────

interface CreateChildWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: (child: ChildRef) => void;
}

export function CreateChildWizard({ open, onOpenChange, onFinished }: CreateChildWizardProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [child, setChild] = React.useState<ChildRef | null>(null);
  const [enrollmentDate, setEnrollmentDate] = React.useState('');
  const [classroomId, setClassroomId] = React.useState('');

  function resetAll() {
    setStepIndex(0);
    setChild(null);
    setEnrollmentDate('');
    setClassroomId('');
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetAll();
    onOpenChange(isOpen);
  }

  function handleFinish() {
    if (child) onFinished?.(child);
    resetAll();
    onOpenChange(false);
  }

  const step: Step = STEPS[stepIndex];
  const stepLabels: Record<Step, string> = {
    basics: t('children.wizard.steps.basics'),
    parent: t('children.wizard.steps.parent'),
    emergency: t('children.wizard.steps.emergency'),
    medical: t('children.wizard.steps.medical'),
    classroom: t('children.wizard.steps.classroom'),
    fees: t('children.wizard.steps.fees'),
  };

  // Emergency/medical steps save each entry via their own "Ajouter" button, so
  // text typed but not added would be silently lost when moving on.
  const [hasUnsavedEntry, setHasUnsavedEntry] = React.useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = React.useState(false);

  React.useEffect(() => {
    setHasUnsavedEntry(false);
    setShowUnsavedWarning(false);
  }, [stepIndex]);

  React.useEffect(() => {
    if (!hasUnsavedEntry) setShowUnsavedWarning(false);
  }, [hasUnsavedEntry]);

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }
  function goNextUnlessUnsaved() {
    if (hasUnsavedEntry && !showUnsavedWarning) {
      setShowUnsavedWarning(true);
      return;
    }
    goNext();
  }

  const unsavedWarning = showUnsavedWarning && (
    <p className="text-body text-danger mt-4" role="alert">
      {t('children.wizard.unsavedEntryWarning')}
    </p>
  );

  const childName = child ? `${child.first_name} ${child.last_name}` : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('children.wizard.title')}</DialogTitle>
          <DialogDescription>
            {t('children.wizard.stepIndicator', {
              current: stepIndex + 1,
              total: STEPS.length,
              label: stepLabels[step],
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn('h-1 flex-1 rounded-full', i <= stepIndex ? 'bg-primary' : 'bg-border')}
            />
          ))}
        </div>

        {step === 'basics' && (
          <BasicsStep
            onCreated={(c, date) => {
              setChild(c);
              setEnrollmentDate(date);
              goNext();
            }}
            onCancel={() => handleClose(false)}
          />
        )}

        {step === 'parent' && child && (
          <ParentStep childId={child.id} onBack={goBack} onNext={goNext} />
        )}

        {step === 'emergency' && child && (
          <div>
            <EmergencyContactsManager childId={child.id} childName={childName} onUnsavedChange={setHasUnsavedEntry} />
            {unsavedWarning}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={goBack}>
                {t('children.wizard.back')}
              </Button>
              <Button type="button" onClick={goNextUnlessUnsaved}>
                {t('children.wizard.next')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'medical' && child && (
          <div>
            <MedicalNotesManager childId={child.id} childName={childName} onUnsavedChange={setHasUnsavedEntry} />
            {unsavedWarning}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={goBack}>
                {t('children.wizard.back')}
              </Button>
              <Button type="button" onClick={goNextUnlessUnsaved}>
                {t('children.wizard.next')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'classroom' && child && (
          <ClassroomStep
            childId={child.id}
            classroomId={classroomId}
            onClassroomChange={setClassroomId}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {step === 'fees' && child && (
          <FeesStep
            child={child}
            classroomId={classroomId}
            enrollmentDate={enrollmentDate}
            onBack={goBack}
            onFinish={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
