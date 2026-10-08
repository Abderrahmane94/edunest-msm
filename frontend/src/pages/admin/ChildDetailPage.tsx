import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, X, Star, Pencil, Check } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EditButton,
  EditFormActions,
  EntityDeleteButton,
  PageHeader,
  ReadOnlyFieldset,
  StatusBadge,
  useConfirm,
  useEditMode,
} from '@/components/ui';
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
import { ChildFeesSection } from './ChildFeesSection';

export function ChildDetailPage() {
  const { t } = useTranslation();
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();

  const { data: child, isLoading } = useChild(childId!);
  const updateChild = useUpdateChild();
  const enrollChild = useEnrollChild();
  const { data: parentLinks } = useParentLinks(childId!);
  const removeParentLink = useRemoveParentLink();
  const { confirm, dialog: confirmDialog } = useConfirm();
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
  const [classroomDialogOpen, setClassroomDialogOpen] = React.useState(false);
  const [parentsDialogOpen, setParentsDialogOpen] = React.useState(false);
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [editLinkRelationship, setEditLinkRelationship] = React.useState('mother');
  const [editLinkCanPickup, setEditLinkCanPickup] = React.useState(true);

  const toForm = React.useCallback(
    (c: NonNullable<typeof child>) => ({
      first_name: c.first_name,
      last_name: c.last_name,
      date_of_birth: c.date_of_birth?.split('T')[0] ?? '',
      gender: c.gender,
      enrollment_date: c.enrollment_date?.split('T')[0] ?? '',
      national_id: c.national_id ?? '',
      address: c.address ?? '',
      place_of_birth: c.place_of_birth ?? '',
      blood_type: (c.blood_type ?? '') as BloodType | '',
    }),
    [],
  );
  const edit = useEditMode(() => {
    if (child) setFormData(toForm(child));
    setSaveError(null);
  });

  // Follow the saved child while reading; never overwrite what is being typed.
  React.useEffect(() => {
    if (child && !edit.editing) setFormData(toForm(child));
  }, [child, edit.editing, toForm]);

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
      // Optional fields left empty are not sent: the server refuses an empty string.
      await updateChild.mutateAsync({
        id: childId!,
        ...formData,
        national_id: formData.national_id || undefined,
        address: formData.address || undefined,
        place_of_birth: formData.place_of_birth || undefined,
        blood_type: formData.blood_type || undefined,
      });
      edit.finishEditing();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }

  async function handleEnroll() {
    setEnrollError(null);
    if (!enrollClassroomId) return;
    try {
      await enrollChild.mutateAsync({ childId: childId!, classroomId: enrollClassroomId });
      setEnrollClassroomId('');
      setClassroomDialogOpen(false);
    } catch (err) {
      setEnrollError(errorMessage(err, t));
    }
  }

  async function handleLinkParent() {
    setLinkError(null);
    if (!linkParentId) return;
    try {
      await linkParent.mutateAsync({ childId: childId!, parentId: linkParentId, relationship: linkRelationship });
      setLinkParentId('');
    } catch (err) {
      setLinkError(errorMessage(err, t));
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
      <div className="space-y-6 animate-fade-in">
        <PageHeader back="/admin/children" title={t('children.notFound')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDialog}
      <PageHeader
        back="/admin/children"
        title={`${child.first_name} ${child.last_name}`}
        description={child.classroom_name}
        badge={
          <StatusBadge variant={child.is_active ? 'success' : 'neutral'}>
            {child.is_active ? t('children.active') : t('children.inactive')}
          </StatusBadge>
        }
      />

      {/* Edit form */}
      <form onSubmit={handleSave}>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-subsection font-semibold text-text-heading">{t('children.detail.info')}</h2>
            <EditButton onClick={edit.startEditing} hidden={edit.editing} />
          </div>
          <ReadOnlyFieldset readOnly={!edit.editing}>
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
          </ReadOnlyFieldset>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4 empty:hidden">
          {edit.editing && <EditFormActions saving={updateChild.isPending} onCancel={edit.cancelEditing} />}
          {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
          {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
        </div>
      </form>

      {/* Classroom enrollment */}
      {classroomOptions.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-subsection font-semibold text-text-heading">{t('children.detail.classroom')}</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setEnrollClassroomId('');
                setEnrollError(null);
                setClassroomDialogOpen(true);
              }}
            >
              {child.classroom_name ? t('children.detail.changeTo') : t('children.detail.enroll')}
            </Button>
          </div>
          <p className={child.classroom_name ? 'text-body text-foreground' : 'text-body text-text-secondary'}>
            {child.classroom_name ?? t('children.detail.noClassroom')}
          </p>
        </div>
      )}

      <Dialog open={classroomDialogOpen} onOpenChange={setClassroomDialogOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{child.classroom_name ? t('children.detail.changeTo') : t('children.detail.enroll')}</DialogTitle>
            <DialogDescription>{t('children.detail.classroomDialogDescription', { name: child.first_name })}</DialogDescription>
          </DialogHeader>
          <FormSelect
            label={child.classroom_name ? t('children.detail.changeTo') : t('children.detail.enrollIn')}
            name="enroll-classroom"
            value={enrollClassroomId}
            onChange={(e) => setEnrollClassroomId(e.target.value)}
            options={classroomOptions.filter((o) => o.label !== child.classroom_name)}
            placeholder={t('children.detail.selectClassroom')}
          />
          {enrollError && <p className="text-body text-danger">{enrollError}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setClassroomDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleEnroll} disabled={!enrollClassroomId || enrollChild.isPending}>
              {enrollChild.isPending
                ? t('common.loading')
                : child.classroom_name ? t('children.detail.change') : t('children.detail.enroll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parent links */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-subsection font-semibold text-text-heading">{t('children.detail.parents')}</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setLinkError(null);
              setEditingLinkId(null);
              setParentsDialogOpen(true);
            }}
          >
            {t('children.detail.manageParents')}
          </Button>
        </div>
        {!hasAuthorizedPickup && (
          <StatusBadge variant="absent" className="whitespace-normal max-w-full">
            {t('children.emergencyContacts.noPickupContact')}
          </StatusBadge>
        )}
        {(parentLinks ?? []).length === 0 ? (
          <p className="text-body text-text-secondary">{t('children.noParents')}</p>
        ) : (
          <div className="space-y-2">
            {(parentLinks as Record<string, unknown>[]).map((link) => {
              const parent = link.parent as Record<string, unknown>;
              return (
                <div key={link.id as string} className="bg-subtle rounded-lg px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      className="text-body font-medium text-primary hover:underline text-start"
                      onClick={() => navigate(`/admin/users/${parent?.id as string}`)}
                    >
                      {parent?.firstName as string} {parent?.lastName as string}
                    </button>
                    <span className="text-caption text-text-secondary">
                      ({t(`children.linkParent.${link.relationship as string}`, { defaultValue: link.relationship as string })})
                    </span>
                    {!!link.isPrimary && (
                      <span className="flex items-center gap-0.5 text-micro text-success font-medium">
                        <Star className="w-3.5 h-3.5 fill-current" /> {t('children.detail.primary')}
                      </span>
                    )}
                    {link.canPickup === false && (
                      <span className="text-micro text-danger font-medium">{t('children.linkParent.cannotPickup')}</span>
                    )}
                  </div>
                  {!!parent?.email && (
                    <p className="text-caption text-text-secondary"><span dir="ltr">{parent.email as string}</span></p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={parentsDialogOpen}
        onOpenChange={(open) => {
          setParentsDialogOpen(open);
          if (!open) setEditingLinkId(null);
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('children.detail.manageParents')}</DialogTitle>
            <DialogDescription>{t('children.detail.parentsDialogDescription', { name: child.first_name })}</DialogDescription>
          </DialogHeader>
        <div className="space-y-3">
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
                        <span className="text-caption text-text-secondary">
                          ({t(`children.linkParent.${link.relationship as string}`, { defaultValue: link.relationship as string })})
                        </span>
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
                      <p className="text-caption text-text-secondary"><span dir="ltr">{parent.email as string}</span></p>
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
                          setLinkError(null);
                          updateParentLink.mutate(
                            { childId: childId!, linkId, relationship: editLinkRelationship, canPickup: editLinkCanPickup },
                            { onError: (err) => setLinkError(errorMessage(err, t)) },
                          );
                          setEditingLinkId(null);
                        }}
                        disabled={updateParentLink.isPending}
                        aria-label={t('common.save')}
                        title={t('common.save')}
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
                            onClick={() => {
                              setLinkError(null);
                              setPrimaryParentLink.mutate({ childId: childId!, linkId }, { onError: (err) => setLinkError(errorMessage(err, t)) });
                            }}
                            disabled={setPrimaryParentLink.isPending}
                            aria-label={t('children.detail.setPrimary')}
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
                          aria-label={t('common.edit')}
                          title={t('common.edit')}
                        >
                          <Pencil className="w-4 h-4 text-text-secondary" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('confirmations.parentLink.remove')}
                      title={t('confirmations.parentLink.remove')}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('confirmations.parentLink.title', {
                            name: `${parent?.firstName as string} ${parent?.lastName as string}`,
                          }),
                          description: t('confirmations.parentLink.description', { child: child.first_name }),
                          confirmLabel: t('confirmations.parentLink.remove'),
                        });
                        if (!ok) return;
                        setLinkError(null);
                        removeParentLink.mutate({ childId: childId!, linkId }, { onError: (err) => setLinkError(errorMessage(err, t)) });
                      }}
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
          <div className="flex flex-col sm:flex-row sm:items-end gap-x-3 pt-2 border-t border-border">
            <div className="flex-1 min-w-0">
              <FormSelect
                label={t('children.linkParent.parent')}
                name="link-parent"
                value={linkParentId}
                onChange={(e) => setLinkParentId(e.target.value)}
                options={parentOptions}
                placeholder={t('children.linkParent.selectParent')}
              />
            </div>
            <div className="sm:w-40">
              <FormSelect
                label={t('children.linkParent.relationship')}
                name="link-relationship"
                value={linkRelationship}
                onChange={(e) => setLinkRelationship(e.target.value)}
                options={relationshipOptions}
              />
            </div>
            <Button type="button" className="mb-4" onClick={handleLinkParent} disabled={!linkParentId || linkParent.isPending}>
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
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setParentsDialogOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      <span className="text-caption text-text-secondary ms-2">
                        ({t(`children.emergencyContacts.relationships.${c.relationship}`, { defaultValue: c.relationship })})
                      </span>
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

      {/* Assigned fees */}
      <ChildFeesSection childId={childId!} />

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
