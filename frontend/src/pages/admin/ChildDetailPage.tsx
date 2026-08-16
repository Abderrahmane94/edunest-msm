import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, UserPlus, X, Star, Pencil, Check } from 'lucide-react';
import { Button, StatusBadge, EntityDeleteButton } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import {
  useChild,
  useUpdateChild,
  useEnrollChild,
  useParentLinks,
  useRemoveParentLink,
  useUpdateParentLink,
  useSetPrimaryParentLink,
  useEmergencyContacts,
  useMedicalNotes,
  useLinkParent,
  type BloodType,
} from '@/hooks/useChildren';
import { useClassrooms } from '@/hooks/useClassrooms';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useUsers } from '@/hooks/useUsers';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { MedicalNotesDialog, severityBadgeVariant } from './MedicalNotesDialog';

export function ChildDetailPage() {
  const { t } = useTranslation();
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();

  const { data: child, isLoading } = useChild(childId!);
  const updateChild = useUpdateChild();
  const enrollChild = useEnrollChild();
  const { data: parentLinks } = useParentLinks(childId!);
  const removeParentLink = useRemoveParentLink();
  const updateParentLink = useUpdateParentLink();
  const setPrimaryParentLink = useSetPrimaryParentLink();
  const { data: emergencyContacts } = useEmergencyContacts(childId!);
  const { data: medicalNotes } = useMedicalNotes(childId!);
  const linkParent = useLinkParent();

  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms } = useClassrooms(activeYear?.id);
  const { data: usersData } = useUsers({ pageSize: 100 });
  const parents = (usersData?.users ?? []).filter((u) => u.role === 'parent');

  const [formData, setFormData] = React.useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    enrollment_date: '',
    national_id: '',
    address: '',
    place_of_birth: '',
    blood_type: '' as BloodType | '',
  });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [enrollClassroomId, setEnrollClassroomId] = React.useState('');
  const [enrollError, setEnrollError] = React.useState<string | null>(null);
  const [linkParentId, setLinkParentId] = React.useState('');
  const [linkRelationship, setLinkRelationship] = React.useState('mother');
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = React.useState(false);
  const [medicalDialogOpen, setMedicalDialogOpen] = React.useState(false);
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [editLinkRelationship, setEditLinkRelationship] = React.useState('mother');
  const [editLinkCanPickup, setEditLinkCanPickup] = React.useState(true);

  React.useEffect(() => {
    if (child) {
      setFormData({
        first_name: child.first_name,
        last_name: child.last_name,
        date_of_birth: child.date_of_birth?.split('T')[0] ?? '',
        gender: child.gender,
        enrollment_date: child.enrollment_date?.split('T')[0] ?? '',
        national_id: child.national_id ?? '',
        address: child.address ?? '',
        place_of_birth: child.place_of_birth ?? '',
        blood_type: child.blood_type ?? '',
      });
    }
  }, [child]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateChild.mutateAsync({ id: childId!, ...formData, blood_type: formData.blood_type || undefined });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleEnroll() {
    setEnrollError(null);
    if (!enrollClassroomId) return;
    try {
      await enrollChild.mutateAsync({ childId: childId!, classroomId: enrollClassroomId });
      setEnrollClassroomId('');
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleLinkParent() {
    setLinkError(null);
    if (!linkParentId) return;
    try {
      await linkParent.mutateAsync({ childId: childId!, parentId: linkParentId, relationship: linkRelationship });
      setLinkParentId('');
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const genderOptions = [
    { value: 'male', label: t('children.form.male') },
    { value: 'female', label: t('children.form.female') },
  ];

  const relationshipOptions = [
    { value: 'mother', label: t('children.linkParent.mother') },
    { value: 'father', label: t('children.linkParent.father') },
    { value: 'guardian', label: t('children.linkParent.guardian') },
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

  const classroomOptions = (classrooms ?? []).map((c) => ({ value: c.id, label: c.name }));
  const parentOptions = parents
    .filter((p) => !(parentLinks ?? []).some((l: Record<string, unknown>) => l.parentUserId === p.id))
    .map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name} (${p.email})` }));

  const hasAuthorizedPickup =
    (parentLinks ?? []).some((l: Record<string, unknown>) => l.canPickup !== false) ||
    (emergencyContacts ?? []).some((c) => c.is_authorized_pickup);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md" />
          <div className="h-10 bg-hover rounded-md" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/children')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('children.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/children')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-page-title font-semibold text-text-heading">
            {child.first_name} {child.last_name}
          </h1>
          {child.classroom_name && (
            <p className="text-body text-text-secondary">{child.classroom_name}</p>
          )}
        </div>
        <StatusBadge variant={child.is_active ? 'present' : 'cancelled'}>
          {child.is_active ? t('children.active') : t('children.inactive')}
        </StatusBadge>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading">{t('children.detail.info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('children.form.firstName')} htmlFor="c-first-name" required>
              <Input id="c-first-name" name="first_name" value={formData.first_name} onChange={handleChange} />
            </FormField>
            <FormField label={t('children.form.lastName')} htmlFor="c-last-name" required>
              <Input id="c-last-name" name="last_name" value={formData.last_name} onChange={handleChange} />
            </FormField>
            <FormField label={t('children.form.dateOfBirth')} htmlFor="c-dob" required>
              <Input id="c-dob" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} />
            </FormField>
            <FormField label={t('children.form.gender')} htmlFor="c-gender">
              <FormSelect label="" name="gender" value={formData.gender} onChange={handleSelectChange} options={genderOptions} />
            </FormField>
            <FormField label={t('children.form.enrollmentDate')} htmlFor="c-enrollment">
              <Input id="c-enrollment" name="enrollment_date" type="date" value={formData.enrollment_date} onChange={handleChange} />
            </FormField>
            <FormField label={t('children.form.nationalId')} htmlFor="c-national-id">
              <Input id="c-national-id" name="national_id" value={formData.national_id} onChange={handleChange} />
            </FormField>
            <FormField label={t('children.form.placeOfBirth')} htmlFor="c-place-of-birth">
              <Input id="c-place-of-birth" name="place_of_birth" value={formData.place_of_birth} onChange={handleChange} />
            </FormField>
            <FormField label={t('children.form.bloodType')} htmlFor="c-blood-type">
              <FormSelect
                label=""
                name="blood_type"
                value={formData.blood_type}
                onChange={handleSelectChange}
                options={bloodTypeOptions}
                placeholder={t('children.form.selectBloodType')}
              />
            </FormField>
          </div>
          <FormField label={t('children.form.address')} htmlFor="c-address">
            <Input id="c-address" name="address" value={formData.address} onChange={handleChange} />
          </FormField>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <Button type="submit" disabled={updateChild.isPending}>
            <Save className="w-4 h-4" />
            {updateChild.isPending ? t('common.loading') : t('common.save')}
          </Button>
          {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
          {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
        </div>
      </form>

      {/* Classroom enrollment */}
      {classroomOptions.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h2 className="text-subsection font-semibold text-text-heading">{t('children.detail.classroom')}</h2>
          <p className="text-body text-text-secondary">
            {child.classroom_name ?? t('children.detail.noClassroom')}
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <FormSelect
                label={t('children.detail.enrollIn')}
                name="enroll-classroom"
                value={enrollClassroomId}
                onChange={(e) => setEnrollClassroomId(e.target.value)}
                options={classroomOptions}
                placeholder={t('children.detail.selectClassroom')}
              />
            </div>
            <Button type="button" variant="secondary" onClick={handleEnroll} disabled={!enrollClassroomId || enrollChild.isPending}>
              {enrollChild.isPending ? t('common.loading') : t('children.detail.enroll')}
            </Button>
          </div>
          {enrollError && <p className="text-body text-danger">{enrollError}</p>}
        </div>
      )}

      {/* Parent links */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-text-heading">{t('children.detail.parents')}</h2>
        {!hasAuthorizedPickup && (
          <StatusBadge variant="absent">{t('children.emergencyContacts.noPickupContact')}</StatusBadge>
        )}
        {(parentLinks ?? []).length === 0 ? (
          <p className="text-body text-text-secondary">{t('children.noParents')}</p>
        ) : (
          <div className="space-y-2">
            {(parentLinks as Record<string, unknown>[]).map((link) => {
              const linkId = link.id as string;
              const isEditing = editingLinkId === linkId;
              const parent = link.parent as Record<string, unknown>;
              return (
                <div key={linkId} className="flex items-center justify-between bg-subtle rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-body font-medium text-primary hover:underline text-start"
                        onClick={() => navigate(`/admin/users/${parent?.id as string}`)}
                      >
                        {parent?.firstName as string} {parent?.lastName as string}
                      </button>
                      {isEditing ? (
                        <div className="w-36">
                          <FormSelect
                            label=""
                            name={`edit-relationship-${linkId}`}
                            value={editLinkRelationship}
                            onChange={(e) => setEditLinkRelationship(e.target.value)}
                            options={relationshipOptions}
                          />
                        </div>
                      ) : (
                        <span className="text-caption text-text-secondary">({link.relationship as string})</span>
                      )}
                      {!!link.isPrimary && (
                        <span className="flex items-center gap-0.5 text-micro text-success font-medium">
                          <Star className="w-3.5 h-3.5 fill-current" /> {t('children.detail.primary')}
                        </span>
                      )}
                      {!isEditing && link.canPickup === false && (
                        <span className="text-micro text-danger font-medium">
                          {t('children.linkParent.cannotPickup')}
                        </span>
                      )}
                    </div>
                    {!!parent?.email && (
                      <p className="text-caption text-text-secondary" dir="ltr">{parent.email as string}</p>
                    )}
                    {isEditing && (
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editLinkCanPickup}
                          onChange={(e) => setEditLinkCanPickup(e.target.checked)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-caption text-foreground">{t('children.linkParent.canPickup')}</span>
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          updateParentLink.mutate({ childId: childId!, linkId, relationship: editLinkRelationship, canPickup: editLinkCanPickup });
                          setEditingLinkId(null);
                        }}
                        disabled={updateParentLink.isPending}
                      >
                        <Check className="w-4 h-4 text-success" />
                      </Button>
                    ) : (
                      <>
                        {!link.isPrimary && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('children.detail.setPrimary')}
                            onClick={() => setPrimaryParentLink.mutate({ childId: childId!, linkId })}
                            disabled={setPrimaryParentLink.isPending}
                          >
                            <Star className="w-4 h-4 text-text-secondary" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingLinkId(linkId);
                            setEditLinkRelationship(link.relationship as string);
                            setEditLinkCanPickup(link.canPickup !== false);
                          }}
                        >
                          <Pencil className="w-4 h-4 text-text-secondary" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParentLink.mutate({ childId: childId!, linkId })}
                      disabled={removeParentLink.isPending}
                    >
                      <X className="w-4 h-4 text-danger" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {parentOptions.length > 0 && (parentLinks ?? []).length < 2 && (
          <div className="flex items-end gap-3 pt-2">
            <div className="flex-1">
              <FormSelect
                label={t('children.linkParent.parent')}
                name="link-parent"
                value={linkParentId}
                onChange={(e) => setLinkParentId(e.target.value)}
                options={parentOptions}
                placeholder={t('children.linkParent.selectParent')}
              />
            </div>
            <div className="w-40">
              <FormSelect
                label={t('children.linkParent.relationship')}
                name="link-relationship"
                value={linkRelationship}
                onChange={(e) => setLinkRelationship(e.target.value)}
                options={relationshipOptions}
              />
            </div>
            <Button type="button" onClick={handleLinkParent} disabled={!linkParentId || linkParent.isPending}>
              <UserPlus className="w-4 h-4" />
              {linkParent.isPending ? t('common.loading') : t('children.detail.link')}
            </Button>
          </div>
        )}
        {(parentLinks ?? []).length >= 2 && (
          <p className="text-caption text-text-secondary">{t('children.detail.maxParentsReached')}</p>
        )}
        {linkError && <p className="text-body text-danger">{linkError}</p>}
      </div>

      {/* Emergency contacts */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-subsection font-semibold text-text-heading">{t('children.emergencyContacts.title')}</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEmergencyDialogOpen(true)}>
            {t('children.emergencyContacts.manage')}
          </Button>
        </div>

        {(emergencyContacts ?? []).length === 0 ? (
          <p className="text-body text-text-secondary">{t('children.emergencyContacts.noContacts')}</p>
        ) : (
          <>
            <div className="space-y-2">
              {(emergencyContacts ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-subtle rounded-lg px-3 py-2">
                  <div>
                    <div>
                      <span className="text-body font-medium text-foreground">{c.name}</span>
                      <span className="text-caption text-text-secondary ms-2">({c.relationship})</span>
                      <span className="text-caption text-text-secondary ms-2">{c.phone}</span>
                      {c.is_authorized_pickup && <span className="ms-2 text-micro text-success font-medium">{t('children.emergencyContacts.authorizedPickup')}</span>}
                    </div>
                    {(c.address || c.national_id) && (
                      <p className="text-caption text-text-secondary">
                        {c.address && <span>{c.address}</span>}
                        {c.address && c.national_id && <span> · </span>}
                        {c.national_id && <span dir="ltr">{c.national_id}</span>}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <EmergencyContactsDialog
        open={emergencyDialogOpen}
        onOpenChange={setEmergencyDialogOpen}
        childId={childId!}
        childName={child ? `${child.first_name} ${child.last_name}` : ''}
      />

      {/* Medical notes */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-subsection font-semibold text-text-heading">{t('children.medicalNotes.title')}</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setMedicalDialogOpen(true)}>
            {t('children.medicalNotes.manage')}
          </Button>
        </div>

        {(medicalNotes ?? []).length === 0 ? (
          <p className="text-body text-text-secondary">{t('children.medicalNotes.noNotes')}</p>
        ) : (
          <div className="space-y-2">
            {(medicalNotes ?? []).map((n) => (
              <div key={n.id} className="flex items-center justify-between bg-subtle rounded-lg px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-body font-medium text-foreground">{n.title}</span>
                    <StatusBadge variant={severityBadgeVariant(n.severity)}>
                      {t(`children.medicalNotes.severities.${n.severity}`)}
                    </StatusBadge>
                  </div>
                  <p className="text-caption text-text-secondary">
                    {t(`children.medicalNotes.types.${n.type}`)}
                    {n.details && <span> • {n.details}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MedicalNotesDialog
        open={medicalDialogOpen}
        onOpenChange={setMedicalDialogOpen}
        childId={childId!}
        childName={child ? `${child.first_name} ${child.last_name}` : ''}
      />

      {/* Danger zone */}
      <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-danger">{t('children.detail.dangerZone')}</h2>
        <p className="text-body text-text-secondary">{t('children.detail.deleteWarning')}</p>
        <EntityDeleteButton
          entityType="children"
          entityId={childId!}
          entityDisplayName={`${child.first_name} ${child.last_name}`}
          onDeleted={() => navigate('/admin/children')}
          hidden={!!child.deleted_at}
        />
      </div>
    </div>
  );
}
