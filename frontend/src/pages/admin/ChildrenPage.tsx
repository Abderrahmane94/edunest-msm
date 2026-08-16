import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Link2, Phone, HeartPulse } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
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
  useChildren, useCreateChild, useLinkParent, useMedicalNotes,
  type Child, type BloodType,
} from '@/hooks/useChildren';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useUsers } from '@/hooks/useUsers';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { MedicalNotesDialog } from './MedicalNotesDialog';

/** Minimal shape needed by dialogs that only display/reference a child's identity. */
type ChildRef = Pick<Child, 'id' | 'first_name' | 'last_name'>;

/** Small table-cell warning shown when nobody — parent or emergency contact — is authorized to pick up this child. */
function PickupContactWarning({ child }: { child: Child }) {
  const { t } = useTranslation();
  if (child.has_authorized_pickup !== false) return null;
  return (
    <StatusBadge variant="absent" title={t('children.emergencyContacts.noPickupContact')}>
      {t('children.emergencyContacts.noPickupContact')}
    </StatusBadge>
  );
}

/** Small table-cell warning shown when a child has a high-severity medical note. */
function HighSeverityMedicalWarning({ childId }: { childId: string }) {
  const { t } = useTranslation();
  const { data: notes } = useMedicalNotes(childId);
  if (!notes || !notes.some((n) => n.severity === 'high')) return null;
  return (
    <StatusBadge variant="absent" title={t('children.medicalNotes.highSeverityWarning')}>
      {t('children.medicalNotes.highSeverityWarning')}
    </StatusBadge>
  );
}

function CreateChildDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (child: ChildRef) => void;
}) {
  const { t } = useTranslation();
  const createChild = useCreateChild();
  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const today = new Date().toISOString().split('T')[0];
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

  function resetForm() {
    setFormData({ ...emptyForm, enrollment_date: today });
    setErrors({});
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
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) {
      newErrors.first_name = t('children.form.firstNameRequired');
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = t('children.form.lastNameRequired');
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = t('children.form.dobRequired');
    }
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
      resetForm();
      onOpenChange(false);
      const newId = (result as { id?: string } | undefined)?.id;
      if (newId) onCreated?.({ id: newId, first_name, last_name });
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('children.form.title')}</DialogTitle>
          <DialogDescription>{t('children.form.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('children.form.firstName')}
              htmlFor="child-first-name"
              error={errors.first_name}
              required
            >
              <Input
                id="child-first-name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder={t('children.form.firstNamePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('children.form.lastName')}
              htmlFor="child-last-name"
              error={errors.last_name}
              required
            >
              <Input
                id="child-last-name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder={t('children.form.lastNamePlaceholder')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('children.form.dateOfBirth')}
              htmlFor="child-dob"
              error={errors.date_of_birth}
              required
            >
              <Input
                id="child-dob"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleChange}
              />
            </FormField>

            <FormSelect
              label={t('children.form.gender')}
              name="gender"
              value={formData.gender}
              onChange={handleSelectChange}
              options={genderOptions}
            />
          </div>

          <FormField
            label={t('children.form.enrollmentDate')}
            htmlFor="child-enrollment-date"
            required
          >
            <Input
              id="child-enrollment-date"
              name="enrollment_date"
              type="date"
              value={formData.enrollment_date}
              onChange={handleChange}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('children.form.nationalId')} htmlFor="child-national-id">
              <Input
                id="child-national-id"
                name="national_id"
                value={formData.national_id}
                onChange={handleChange}
                placeholder={t('children.form.nationalIdPlaceholder')}
              />
            </FormField>

            <FormField label={t('children.form.placeOfBirth')} htmlFor="child-place-of-birth">
              <Input
                id="child-place-of-birth"
                name="place_of_birth"
                value={formData.place_of_birth}
                onChange={handleChange}
                placeholder={t('children.form.placeOfBirthPlaceholder')}
              />
            </FormField>
          </div>

          <FormField label={t('children.form.address')} htmlFor="child-address">
            <Input
              id="child-address"
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

          {errors.form && (
            <p className="text-body text-danger mt-1">{errors.form}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createChild.isPending}>
              {createChild.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkParentDialog({
  open,
  onOpenChange,
  child,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: ChildRef | null;
}) {
  const { t } = useTranslation();
  const linkParent = useLinkParent();
  const { data: usersData } = useUsers({ pageSize: 100 });

  const parents = (usersData?.users ?? []).filter((u) => u.role === 'parent');

  const [parentId, setParentId] = React.useState('');
  const [relationship, setRelationship] = React.useState('mother');

  function resetForm() {
    setParentId('');
    setRelationship('mother');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!child || !parentId) return;

    try {
      await linkParent.mutateAsync({
        childId: child.id,
        parentId,
        relationship,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by React Query
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  const parentOptions = parents.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }));

  const relationshipOptions = [
    { value: 'mother', label: t('children.linkParent.mother') },
    { value: 'father', label: t('children.linkParent.father') },
    { value: 'guardian', label: t('children.linkParent.guardian') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('children.linkParent.title')}</DialogTitle>
          <DialogDescription>
            {t('children.linkParent.description', {
              name: child ? `${child.first_name} ${child.last_name}` : '',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
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

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={linkParent.isPending || !parentId}>
              {linkParent.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChildrenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const pageSize = 10;

  const { data, isLoading } = useChildren({ page, pageSize, search: search || undefined });
  const children = data?.children ?? [];
  const total = data?.total ?? 0;

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [linkParentDialogOpen, setLinkParentDialogOpen] = React.useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = React.useState(false);
  const [medicalDialogOpen, setMedicalDialogOpen] = React.useState(false);
  const [selectedChild, setSelectedChild] = React.useState<ChildRef | null>(null);

  function handleSearch(query: string) {
    setSearch(query);
    setPage(1);
  }

  function handleLinkParent(child: Child) {
    setSelectedChild(child);
    setLinkParentDialogOpen(true);
  }

  function handleEmergencyContacts(child: Child) {
    setSelectedChild(child);
    setEmergencyDialogOpen(true);
  }

  function handleMedicalNotes(child: Child) {
    setSelectedChild(child);
    setMedicalDialogOpen(true);
  }

  const columns: Column<Child>[] = [
    {
      key: 'name',
      header: t('children.columns.name'),
      sortable: true,
      render: (child) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center text-label font-semibold">
            {child.first_name.charAt(0)}{child.last_name.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">
              {child.first_name} {child.last_name}
            </p>
            <p className="text-caption text-text-secondary" dir="ltr">
              {formatDate(child.date_of_birth)}
            </p>
          </div>
          <PickupContactWarning child={child} />
          <HighSeverityMedicalWarning childId={child.id} />
        </div>
      ),
    },
    {
      key: 'gender',
      header: t('children.columns.gender'),
      render: (child) => (
        <span className="text-body text-text-secondary">
          {t(`children.form.${child.gender}`)}
        </span>
      ),
    },
    {
      key: 'classroom_name',
      header: t('children.columns.classroom'),
      render: (child) =>
        child.classroom_name ? (
          <span className="text-body text-foreground">{child.classroom_name}</span>
        ) : (
          <span className="text-body text-text-disabled">—</span>
        ),
    },
    {
      key: 'parent_names',
      header: t('children.columns.parents'),
      render: (child) =>
        child.parent_names && child.parent_names.length > 0 ? (
          <span className="text-body text-foreground">{child.parent_names.join(', ')}</span>
        ) : (
          <span className="text-body text-text-disabled">{t('children.noParents')}</span>
        ),
    },
    {
      key: 'is_active',
      header: t('children.columns.status'),
      render: (child) => (
        <StatusBadge variant={child.is_active ? 'present' : 'cancelled'}>
          {child.is_active ? t('children.active') : t('children.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (child) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleLinkParent(child); }}
            aria-label={t('children.linkParent.title')}
            title={t('children.linkParent.title')}
          >
            <Link2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleEmergencyContacts(child); }}
            aria-label={t('children.emergencyContacts.title')}
            title={t('children.emergencyContacts.title')}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleMedicalNotes(child); }}
            aria-label={t('children.medicalNotes.title')}
            title={t('children.medicalNotes.title')}
          >
            <HeartPulse className="w-4 h-4" />
          </Button>
        </div>
      ),
      className: 'w-32',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('children.title')}
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('children.title')}
        </h1>
        <CreateButton label={t('children.register')} onClick={() => setCreateDialogOpen(true)} />
      </div>

      <DataTable<Child>
        columns={columns}
        data={children}
        keyExtractor={(child) => child.id}
        onRowClick={(child) => navigate(`/admin/children/${child.id}`)}
        searchable
        searchPlaceholder={t('children.searchPlaceholder')}
        onSearch={handleSearch}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        emptyMessage={t('children.noChildren')}
      />

      <CreateChildDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(child) => {
          setSelectedChild(child);
          setEmergencyDialogOpen(true);
        }}
      />

      <LinkParentDialog
        open={linkParentDialogOpen}
        onOpenChange={setLinkParentDialogOpen}
        child={selectedChild}
      />

      <EmergencyContactsDialog
        open={emergencyDialogOpen}
        onOpenChange={setEmergencyDialogOpen}
        childId={selectedChild?.id ?? ''}
        childName={selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : ''}
      />

      <MedicalNotesDialog
        open={medicalDialogOpen}
        onOpenChange={setMedicalDialogOpen}
        childId={selectedChild?.id ?? ''}
        childName={selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : ''}
      />
    </div>
  );
}
