import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, useConfirm,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { cn } from '@/lib/utils';
import { formatDate, formatDZD } from '@/lib/formatters';
import {
  useRegisterChild, type BloodType, type EmergencyContact, type MedicalNote, type RegisterChildInput,
} from '@/hooks/useChildren';
import { useViewedYear } from '@/hooks/useSelectedYear';
import { useUsers } from '@/hooks/useUsers';
import { useClassrooms } from '@/hooks/useClassrooms';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useChildBillingPeriods, useRecordPayment } from '@/hooks/usePayments';
import { suggestAllocations, totalOutstanding } from '@/lib/paymentAllocation';
import { EmergencyContactsManager, type EmergencyContactInput } from './EmergencyContactsDialog';
import { MedicalNotesManager, type MedicalNoteInput } from './MedicalNotesDialog';
import { localListStore } from './listStore';
import { FeeChecklist, clampToAcademicYear, useFeeLabel, useOfferedFees } from './FeeChecklist';

/**
 * Steps up to the summary only collect: nothing is saved until "Créer
 * l'inscription" sends everything in one request (all or nothing). Payment
 * comes after, once the child and their billing periods exist.
 */
const STEPS = ['basics', 'parent', 'emergency', 'medical', 'classroom', 'fees', 'summary', 'payment'] as const;
type Step = (typeof STEPS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface BasicsForm {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  enrollment_date: string;
  national_id: string;
  address: string;
  place_of_birth: string;
  blood_type: BloodType | '';
}

function emptyBasics(): BasicsForm {
  return {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'male',
    enrollment_date: todayString(),
    national_id: '',
    address: '',
    place_of_birth: '',
    blood_type: '',
  };
}

interface ParentChoice {
  mode: 'existing' | 'new';
  parentId: string;
  relationship: string;
  newParent: { firstName: string; lastName: string; email: string; phone: string };
}

const emptyParent: ParentChoice = {
  mode: 'existing',
  parentId: '',
  relationship: 'mother',
  newParent: { firstName: '', lastName: '', email: '', phone: '' },
};

function newParentStarted(p: ParentChoice): boolean {
  const { firstName, lastName, email } = p.newParent;
  return p.mode === 'new' && !!(firstName.trim() || lastName.trim() || email.trim());
}

function parentPayload(p: ParentChoice): RegisterChildInput['parent'] {
  if (p.mode === 'existing') {
    return p.parentId ? { relationship: p.relationship, parentUserId: p.parentId } : undefined;
  }
  if (!newParentStarted(p)) return undefined;
  const { firstName, lastName, email, phone } = p.newParent;
  return {
    relationship: p.relationship,
    newParent: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    },
  };
}

function useRelationshipOptions() {
  const { t } = useTranslation();
  return [
    { value: 'mother', label: t('children.linkParent.mother') },
    { value: 'father', label: t('children.linkParent.father') },
    { value: 'guardian', label: t('children.linkParent.guardian') },
  ];
}

function useParents() {
  const { data: usersData } = useUsers({ pageSize: 100 });
  return (usersData?.users ?? []).filter((u) => u.role === 'parent');
}

// ─── Step 1: Basic info ──────────────────────────────────────────────────────

function BasicsStep({
  value: formData,
  onChange: setFormData,
  onCancel,
  onNext,
}: {
  value: BasicsForm;
  onChange: React.Dispatch<React.SetStateAction<BasicsForm>>;
  onCancel: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const { data: activeYear } = useViewedYear();
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
    if (!formData.enrollment_date) newErrors.enrollment_date = t('common.fieldRequired');
    if (!activeYear) newErrors.form = t('children.form.noActiveYear');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onNext();
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

      <FormField label={t('children.form.enrollmentDate')} htmlFor="wz-enrollment-date" error={errors.enrollment_date} required>
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
        <Button type="submit">{t('children.wizard.next')}</Button>
      </DialogFooter>
    </form>
  );
}

// ─── Step 2: Parent ──────────────────────────────────────────────────────────

function ParentStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: ParentChoice;
  onChange: React.Dispatch<React.SetStateAction<ParentChoice>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const parents = useParents();
  const relationshipOptions = useRelationshipOptions();
  const [error, setError] = React.useState<string | null>(null);
  const { mode, parentId, relationship, newParent } = value;

  const parentOptions = parents.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }));

  function setNewParent(field: keyof ParentChoice['newParent'], fieldValue: string) {
    onChange((p) => ({ ...p, newParent: { ...p.newParent, [field]: fieldValue } }));
  }

  function handleNext() {
    if (newParentStarted(value)) {
      if (!newParent.firstName.trim() || !newParent.lastName.trim() || !newParent.email.trim()) {
        setError(t('children.wizard.parent.newParentIncomplete'));
        return;
      }
      if (!EMAIL_PATTERN.test(newParent.email.trim())) {
        setError(t('children.wizard.parent.invalidEmail'));
        return;
      }
    }
    setError(null);
    onNext();
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-text-secondary">{t('children.wizard.parent.description')}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'existing' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onChange((p) => ({ ...p, mode: 'existing' }))}
        >
          {t('children.wizard.parent.selectExisting')}
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onChange((p) => ({ ...p, mode: 'new' }))}
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
            onChange={(e) => onChange((p) => ({ ...p, parentId: e.target.value }))}
            options={parentOptions}
            placeholder={t('children.linkParent.selectParent')}
          />
          <FormSelect
            label={t('children.linkParent.relationship')}
            name="relationship"
            value={relationship}
            onChange={(e) => onChange((p) => ({ ...p, relationship: e.target.value }))}
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
                onChange={(e) => setNewParent('firstName', e.target.value)}
              />
            </FormField>
            <FormField label={t('users.invite_form.lastName')} htmlFor="wz-parent-last">
              <Input
                id="wz-parent-last"
                value={newParent.lastName}
                onChange={(e) => setNewParent('lastName', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('users.invite_form.email')} htmlFor="wz-parent-email">
            <Input
              id="wz-parent-email"
              type="email"
              value={newParent.email}
              onChange={(e) => setNewParent('email', e.target.value)}
            />
          </FormField>
          <FormField label={t('users.invite_form.phone')} htmlFor="wz-parent-phone">
            <Input
              id="wz-parent-phone"
              type="tel"
              value={newParent.phone}
              onChange={(e) => setNewParent('phone', e.target.value)}
            />
          </FormField>
          <FormSelect
            label={t('children.linkParent.relationship')}
            name="relationship-new"
            value={relationship}
            onChange={(e) => onChange((p) => ({ ...p, relationship: e.target.value }))}
            options={relationshipOptions}
          />
        </>
      )}

      {error && <p className="text-body text-danger">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('children.wizard.back')}
        </Button>
        <Button type="button" onClick={handleNext}>
          {t('children.wizard.next')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Step 5: Classroom ───────────────────────────────────────────────────────

function ClassroomStep({
  classroomId,
  onClassroomChange,
  onBack,
  onNext,
}: {
  classroomId: string;
  onClassroomChange: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const { data: activeYear } = useViewedYear();
  const { data: classrooms } = useClassrooms(activeYear?.id);

  const classroomOptions = (classrooms ?? []).map((c) => ({ value: c.id, label: c.name }));

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

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('children.wizard.back')}
        </Button>
        <Button type="button" onClick={onNext}>
          {t('children.wizard.next')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Step 6: Fees ────────────────────────────────────────────────────────────

function FeesStep({
  classroomId,
  selectedFeeIds,
  onSelectedFeeIdsChange,
  onBack,
  onNext,
}: {
  classroomId: string;
  selectedFeeIds: string[];
  onSelectedFeeIdsChange: (ids: string[]) => void;
  onBack: () => void;
  /** `bill`: enroll for billing with the fees shown; false: skip billing for now. */
  onNext: (bill: boolean) => void;
}) {
  const { t } = useTranslation();
  const { schoolFees, optionalFees } = useOfferedFees(classroomId);
  const selected = selectedFeeIds.filter((id) => optionalFees.some((f) => f.id === id));

  // Enrolled for billing as soon as there's something to bill.
  const canEnroll = schoolFees.length > 0 || selected.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-body text-text-secondary">{t('children.wizard.fees.description')}</p>

      <FeeChecklist classroomId={classroomId} selectedFeeIds={selectedFeeIds} onChange={onSelectedFeeIdsChange} />

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('children.wizard.back')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onNext(false)}>
          {t('children.wizard.fees.skipEnrollment')}
        </Button>
        <Button type="button" onClick={() => onNext(true)} disabled={!canEnroll}>
          {t('children.wizard.next')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Step 7: Summary ─────────────────────────────────────────────────────────

function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-caption font-semibold text-text-secondary">{title}</p>
        <div className="text-body text-foreground">{children}</div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        {t('children.wizard.summary.edit')}
      </Button>
    </div>
  );
}

function SummaryStep({
  basics,
  parent,
  contacts,
  notes,
  classroomId,
  bill,
  selectedFeeIds,
  onEditStep,
  onBack,
  onCreate,
  isSaving,
  error,
}: {
  basics: BasicsForm;
  parent: ParentChoice;
  contacts: EmergencyContact[];
  notes: MedicalNote[];
  classroomId: string;
  bill: boolean;
  selectedFeeIds: string[];
  onEditStep: (step: Step) => void;
  onBack: () => void;
  onCreate: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const parents = useParents();
  const relationshipOptions = useRelationshipOptions();
  const { data: activeYear } = useViewedYear();
  const { data: classrooms } = useClassrooms(activeYear?.id);
  const feeLabel = useFeeLabel();
  const { schoolFees, optionalFees } = useOfferedFees(classroomId);

  const chosenParent = parentPayload(parent);
  const relationshipLabel = relationshipOptions.find((o) => o.value === parent.relationship)?.label;
  const existingParent = parents.find((p) => p.id === parent.parentId);
  const classroom = (classrooms ?? []).find((c) => c.id === classroomId);
  const billedFees = [...schoolFees, ...optionalFees.filter((f) => selectedFeeIds.includes(f.id))];
  const none = <span className="text-text-secondary">{t('children.wizard.summary.none')}</span>;

  return (
    <div>
      <p className="text-body text-text-secondary mb-2">{t('children.wizard.summary.description')}</p>

      <div className="divide-y divide-border">
        <SummarySection title={t('children.wizard.summary.child')} onEdit={() => onEditStep('basics')}>
          <p className="font-medium">{basics.first_name.trim()} {basics.last_name.trim()}</p>
          <p className="text-caption text-text-secondary">
            {t(`children.form.${basics.gender}`)}
            {basics.date_of_birth && <> • {t('children.wizard.summary.bornOn', { date: formatDate(basics.date_of_birth) })}</>}
            {basics.enrollment_date && <> • {t('children.wizard.summary.enrolledOn', { date: formatDate(basics.enrollment_date) })}</>}
          </p>
        </SummarySection>

        <SummarySection title={t('children.wizard.summary.parent')} onEdit={() => onEditStep('parent')}>
          {!chosenParent ? (
            <span className="text-text-secondary">{t('children.wizard.summary.noParent')}</span>
          ) : 'newParent' in chosenParent ? (
            <p>
              {chosenParent.newParent.firstName} {chosenParent.newParent.lastName} ({relationshipLabel}) •{' '}
              <span dir="ltr">{chosenParent.newParent.email}</span>{' '}
              <span className="text-caption text-primary font-medium">{t('children.wizard.summary.newAccount')}</span>
            </p>
          ) : (
            <p>{existingParent ? `${existingParent.first_name} ${existingParent.last_name}` : '—'} ({relationshipLabel})</p>
          )}
        </SummarySection>

        <SummarySection title={t('children.wizard.summary.emergency')} onEdit={() => onEditStep('emergency')}>
          {contacts.length === 0 ? none : (
            <ul>
              {contacts.map((c) => (
                <li key={c.id}>{c.name} • <span dir="ltr">{c.phone}</span></li>
              ))}
            </ul>
          )}
        </SummarySection>

        <SummarySection title={t('children.wizard.summary.medical')} onEdit={() => onEditStep('medical')}>
          {notes.length === 0 ? none : (
            <ul>
              {notes.map((n) => (
                <li key={n.id}>{n.title} ({t(`children.medicalNotes.types.${n.type}`)})</li>
              ))}
            </ul>
          )}
        </SummarySection>

        <SummarySection title={t('children.wizard.summary.classroom')} onEdit={() => onEditStep('classroom')}>
          {classroom ? classroom.name : <span className="text-text-secondary">{t('children.wizard.summary.noClassroom')}</span>}
        </SummarySection>

        <SummarySection title={t('children.wizard.summary.fees')} onEdit={() => onEditStep('fees')}>
          {!bill || billedFees.length === 0 ? (
            <span className="text-text-secondary">{t('children.wizard.summary.noBilling')}</span>
          ) : (
            <ul>
              {billedFees.map((f) => <li key={f.id}>{feeLabel(f)}</li>)}
            </ul>
          )}
        </SummarySection>
      </div>

      {error && <p className="text-body text-danger mt-2" role="alert">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack} disabled={isSaving}>
          {t('children.wizard.back')}
        </Button>
        <Button type="button" onClick={onCreate} disabled={isSaving}>
          {isSaving ? t('common.loading') : t('children.wizard.summary.create')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Step 8: Payment ─────────────────────────────────────────────────────────

function PaymentStep({
  childId,
  childName,
  onFinish,
}: {
  childId: string;
  childName: string;
  onFinish: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { branchId } = useDefaultBranch();
  const recordPayment = useRecordPayment(branchId);
  const { data: billingPeriods } = useChildBillingPeriods(childId);
  const outstanding = totalOutstanding(billingPeriods ?? []);

  const [error, setError] = React.useState<string | null>(null);
  const [paymentMode, setPaymentMode] = React.useState<'full' | 'partial' | 'later' | null>(null);
  const [partialAmount, setPartialAmount] = React.useState('');

  async function handleRecordPayment(amount: number) {
    setError(null);
    try {
      const allocations = suggestAllocations(billingPeriods ?? [], amount);
      await recordPayment.mutateAsync({
        childId,
        totalAmount: amount,
        channel: 'cash',
        valueDate: todayString(),
        allocations: allocations.map((a) => ({ billingPeriodId: a.billingPeriodId, amount: Number(a.amount) })),
      });
      onFinish();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-body font-medium text-success">{t('children.wizard.created', { name: childName })}</p>
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
        <Button
          type="button"
          onClick={() => {
            if (paymentMode === 'full') handleRecordPayment(outstanding);
            else if (paymentMode === 'partial') handleRecordPayment(Number(partialAmount) || 0);
            else onFinish();
          }}
          disabled={recordPayment.isPending || (paymentMode === 'partial' && (!partialAmount || Number(partialAmount) <= 0))}
        >
          {recordPayment.isPending ? t('common.loading') : t('children.wizard.finish')}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Wizard shell ────────────────────────────────────────────────────────────

interface CreateChildWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: (child: { id: string; first_name: string; last_name: string }) => void;
}

const toContact = (input: EmergencyContactInput, id: string): EmergencyContact => ({ id, ...input });
const toNote = (input: MedicalNoteInput, id: string): MedicalNote => ({
  id,
  ...input,
  details: input.details ?? null,
  created_at: new Date().toISOString(),
});

export function CreateChildWizard({ open, onOpenChange, onFinished }: CreateChildWizardProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: activeYear } = useViewedYear();
  const registerChild = useRegisterChild();

  const [stepIndex, setStepIndex] = React.useState(0);
  const [basics, setBasics] = React.useState<BasicsForm>(emptyBasics);
  const [parent, setParent] = React.useState<ParentChoice>(emptyParent);
  const [contacts, setContacts] = React.useState<EmergencyContact[]>([]);
  const [notes, setNotes] = React.useState<MedicalNote[]>([]);
  const [classroomId, setClassroomId] = React.useState('');
  const [selectedFeeIds, setSelectedFeeIds] = React.useState<string[]>([]);
  const [bill, setBill] = React.useState(false);
  const [createdChildId, setCreatedChildId] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const { branchId, schoolFees, optionalFees } = useOfferedFees(classroomId);

  const contactStore = localListStore(contacts, setContacts, toContact);
  const noteStore = localListStore(notes, setNotes, toNote);

  function resetAll() {
    setStepIndex(0);
    setBasics(emptyBasics());
    setParent(emptyParent);
    setContacts([]);
    setNotes([]);
    setClassroomId('');
    setSelectedFeeIds([]);
    setBill(false);
    setCreatedChildId(null);
    setCreateError(null);
  }

  function finish() {
    if (createdChildId) {
      onFinished?.({ id: createdChildId, first_name: basics.first_name.trim(), last_name: basics.last_name.trim() });
    }
    resetAll();
    onOpenChange(false);
  }

  // Nothing is saved before the summary, so closing midway drops what was typed: ask first.
  const hasInput =
    !createdChildId &&
    (stepIndex > 0 || !!basics.first_name.trim() || !!basics.last_name.trim() || !!basics.date_of_birth);

  async function handleClose(isOpen: boolean) {
    if (isOpen) {
      onOpenChange(true);
      return;
    }
    if (registerChild.isPending) return;
    if (hasInput) {
      const ok = await confirm({
        title: t('children.wizard.discard.title'),
        description: t('children.wizard.discard.description'),
        confirmLabel: t('children.wizard.discard.confirm'),
      });
      if (!ok) return;
    }
    finish();
  }

  async function handleCreate() {
    if (!activeYear) {
      setCreateError(t('children.form.noActiveYear'));
      return;
    }
    setCreateError(null);
    const feeIds = selectedFeeIds.filter((id) => optionalFees.some((f) => f.id === id));
    const billing =
      bill && branchId && (schoolFees.length > 0 || feeIds.length > 0)
        ? {
            branchId,
            startDate: clampToAcademicYear(basics.enrollment_date, activeYear.start_date, activeYear.end_date),
            feeIds,
          }
        : undefined;
    try {
      const { childId, billed } = await registerChild.mutateAsync({
        child: {
          first_name: basics.first_name.trim(),
          last_name: basics.last_name.trim(),
          date_of_birth: basics.date_of_birth,
          gender: basics.gender,
          enrollment_date: basics.enrollment_date,
          academic_year_id: activeYear.id,
          national_id: basics.national_id.trim() || undefined,
          address: basics.address.trim() || undefined,
          place_of_birth: basics.place_of_birth.trim() || undefined,
          blood_type: basics.blood_type || undefined,
        },
        parent: parentPayload(parent),
        emergencyContacts: contacts.map(({ id: _id, ...contact }) => contact),
        medicalNotes: notes.map(({ type, title, details, severity }) => ({ type, title, details, severity })),
        classroomId: classroomId || undefined,
        billing,
      });
      if (billed) {
        setCreatedChildId(childId);
        await qc.invalidateQueries({ queryKey: ['child-billing-periods', childId] });
        setStepIndex(STEPS.indexOf('payment'));
      } else {
        onFinished?.({ id: childId, first_name: basics.first_name.trim(), last_name: basics.last_name.trim() });
        resetAll();
        onOpenChange(false);
      }
    } catch (err) {
      setCreateError(errorMessage(err, t));
    }
  }

  const step: Step = STEPS[stepIndex];
  const stepLabels: Record<Step, string> = {
    basics: t('children.wizard.steps.basics'),
    parent: t('children.wizard.steps.parent'),
    emergency: t('children.wizard.steps.emergency'),
    medical: t('children.wizard.steps.medical'),
    classroom: t('children.wizard.steps.classroom'),
    fees: t('children.wizard.steps.fees'),
    summary: t('children.wizard.steps.summary'),
    payment: t('children.wizard.steps.payment'),
  };

  // Emergency/medical steps add each entry via their own "Ajouter" button, so
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

  const childName = `${basics.first_name.trim()} ${basics.last_name.trim()}`.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[560px]">
        {confirmDialog}
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
          <BasicsStep value={basics} onChange={setBasics} onCancel={() => handleClose(false)} onNext={goNext} />
        )}

        {step === 'parent' && (
          <ParentStep value={parent} onChange={setParent} onBack={goBack} onNext={goNext} />
        )}

        {step === 'emergency' && (
          <div>
            <EmergencyContactsManager store={contactStore} childName={childName} onUnsavedChange={setHasUnsavedEntry} />
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

        {step === 'medical' && (
          <div>
            <MedicalNotesManager store={noteStore} childName={childName} onUnsavedChange={setHasUnsavedEntry} />
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

        {step === 'classroom' && (
          <ClassroomStep
            classroomId={classroomId}
            onClassroomChange={setClassroomId}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {step === 'fees' && (
          <FeesStep
            classroomId={classroomId}
            selectedFeeIds={selectedFeeIds}
            onSelectedFeeIdsChange={setSelectedFeeIds}
            onBack={goBack}
            onNext={(withBilling) => {
              setBill(withBilling);
              goNext();
            }}
          />
        )}

        {step === 'summary' && (
          <SummaryStep
            basics={basics}
            parent={parent}
            contacts={contacts}
            notes={notes}
            classroomId={classroomId}
            bill={bill}
            selectedFeeIds={selectedFeeIds}
            onEditStep={(s) => setStepIndex(STEPS.indexOf(s))}
            onBack={goBack}
            onCreate={handleCreate}
            isSaving={registerChild.isPending}
            error={createError}
          />
        )}

        {step === 'payment' && createdChildId && (
          <PaymentStep childId={createdChildId} childName={childName} onFinish={finish} />
        )}
      </DialogContent>
    </Dialog>
  );
}
