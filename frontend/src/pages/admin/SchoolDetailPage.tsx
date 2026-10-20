import { announceNewAccount, type CreatedAccount } from '@/lib/newAccount';
import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hourglass, Shield, ShieldOff, Trash2, Users, UserPlus, Settings } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { Button, DangerZone, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EditButton, EditFormActions, EmptyState, EntityDeleteButton, ErrorAlert, Input, ListSkeleton, PageHeader, ReadOnlyFieldset, RoleBadge, StatusBadge, Tabs, useConfirm, useEditMode } from '@/components/ui';

import { avatarColor } from '@/components/ui/Avatar';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { apiClient, apiError } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolToggleConfirm, trialState, TrialBadge, useToggleSchoolActive } from './SchoolsPage';
import type { SchoolItem } from '@/hooks/useSchools';
import { useTabParam } from '@/hooks/useTabParam';

type Tab = 'info' | 'users';

/* ─── Hooks ─── */

function useSchoolDetail(id: string) {
  return useQuery({
    queryKey: ['school-detail', id],
    queryFn: async () => {
      const res = await apiClient.get<SchoolItem>(`/schools/${id}`);
      if (!res.success) throw apiError(res.error, 'School not found');
      return res.data as SchoolItem;
    },
    enabled: !!id,
  });
}

function useUpdateSchoolAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; address?: string; wilaya?: string; contactEmail?: string; contactPhone?: string }) => {
      const res = await apiClient.put(`/schools/${id}`, data);
      if (!res.success) throw apiError(res.error, 'Failed to update school');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
      queryClient.invalidateQueries({ queryKey: ['school-detail', variables.id] });
    },
  });
}

/** The trial's three outcomes: more days, subscribed (kept), or erased for good. */
function useTrialAction(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: { kind: 'extend'; days: number } | { kind: 'subscribed' } | { kind: 'purge'; confirmName: string }) => {
      const res =
        action.kind === 'extend'
          ? await apiClient.patch<SchoolItem>(`/schools/${schoolId}/trial/extend`, { days: action.days })
          : action.kind === 'subscribed'
            ? await apiClient.patch<SchoolItem>(`/schools/${schoolId}/trial/subscribed`)
            : await apiClient.post<SchoolItem>(`/schools/${schoolId}/purge`, { confirmName: action.confirmName });
      if (!res.success) throw apiError(res.error, 'Failed to update the trial');
      return res.data as SchoolItem;
    },
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
      if (action.kind !== 'purge') queryClient.invalidateQueries({ queryKey: ['school-detail', schoolId] });
    },
  });
}

/** A school on trial: until when (or since when it is closed), and what the platform does next. */
function TrialSection({ school }: { school: SchoolItem }) {
  const { t } = useTranslation();
  const trialAction = useTrialAction(school.id);
  const { confirm, dialog } = useConfirm();
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const state = trialState(school);
  if (!state) return null;
  const date = `⁨${formatDate(school.trialEndsAt!)}⁩`;
  const daysLeft = Math.max(1, Math.ceil((new Date(school.trialEndsAt!).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  function run(action: Parameters<typeof trialAction.mutate>[0], done: (data: SchoolItem) => string) {
    setNotice(null);
    setError(null);
    trialAction.mutate(action, {
      onSuccess: (data) => setNotice(done(data)),
      onError: (err) => setError(errorMessage(err, t)),
    });
  }

  return (
    <section className="bg-card border border-warning/40 rounded-lg p-4 sm:p-6 space-y-3">
      {dialog}
      <h2 className="flex items-center gap-2 text-subsection font-semibold text-text-heading">
        <Hourglass className="w-4 h-4 text-warning" />
        {t('schools.trial.cardTitle')}
      </h2>
      <p className="text-body text-foreground">
        {state === 'running' ? t('schools.trial.running', { date, count: daysLeft }) : t('schools.trial.ended', { date })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={trialAction.isPending}
          onClick={async () => {
            if (!(await confirm({ title: t('schools.trial.subscribeTitle', { name: school.name }), description: t('schools.trial.subscribeText'), confirmLabel: t('schools.trial.subscribe'), tone: 'default' }))) return;
            run({ kind: 'subscribed' }, () => t('schools.trial.subscribed'));
          }}
        >
          {t('schools.trial.subscribe')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={trialAction.isPending}
          onClick={() => run({ kind: 'extend', days: 7 }, (data) => t('schools.trial.extended', { date: `⁨${formatDate(data.trialEndsAt!)}⁩` }))}
        >
          {t('schools.trial.extend')}
        </Button>
      </div>
      {notice && <p className="text-body text-success animate-fade-in">{notice}</p>}
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
    </section>
  );
}

/** Erasing a trial that ended without subscribing: its name typed again, then everything goes. */
function PurgeSchoolDialog({ school, open, onOpenChange }: { school: SchoolItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const trialAction = useTrialAction(school.id);
  const [typed, setTyped] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const matches = typed.trim() === school.name.trim();

  function close(v: boolean) {
    if (!v) {
      setTyped('');
      setError(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('schools.trial.purgeTitle', { name: school.name })}</DialogTitle>
          <DialogDescription>{t('schools.trial.purgeText')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!matches) return;
            setError(null);
            trialAction.mutate(
              { kind: 'purge', confirmName: typed },
              {
                onSuccess: () => navigate('/admin/schools', { state: { notice: t('schools.trial.purgeDone', { name: school.name }) } }),
                onError: (err) => setError(errorMessage(err, t)),
              },
            );
          }}
        >
          <FormField label={t('schools.trial.purgeTypeName')} htmlFor="purge-name">
            <Input id="purge-name" name="purge-name" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={school.name} autoComplete="off" />
          </FormField>
          {error && <p className="text-body text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="danger" disabled={!matches || trialAction.isPending}>
              <Trash2 className="w-4 h-4" />
              {trialAction.isPending ? t('common.loading') : t('schools.trial.purge')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SchoolUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  accessProfile?: { id: string; name: string } | null;
  role: string;
  isActive: boolean;
  preferredLanguage: string;
  createdAt: string;
}

function useSchoolUsers(schoolId: string) {
  return useQuery({
    queryKey: ['school-users', schoolId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(`/schools/${schoolId}/users`);
      const raw = res.data;
      return Array.isArray(raw) ? raw as SchoolUser[] : [];
    },
    enabled: !!schoolId,
  });
}

function useCreateUserInSchool(schoolId: string, schoolName?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone: string; role: string; preferredLanguage: string }) => {
      const res = await apiClient.post<CreatedAccount>(`/schools/${schoolId}/users`, data);
      if (!res.success) throw apiError(res.error, 'Failed to create user');
      announceNewAccount(res.data, { role: data.role, schoolName });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-users', schoolId] });
    },
  });
}

/* ─── Page ─── */

export function SchoolDetailPage() {
  const { t } = useTranslation();
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();

  const { data: school, isLoading } = useSchoolDetail(schoolId!);
  const updateSchool = useUpdateSchoolAdmin();
  const toggleSchool = useToggleSchoolActive();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useTabParam<Tab>(['info', 'users'], 'info');
  const [formData, setFormData] = React.useState({
    name: '', address: '', wilaya: '', contactEmail: '', contactPhone: '',
  });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [toggleError, setToggleError] = React.useState<string | null>(null);
  const [purgeOpen, setPurgeOpen] = React.useState(false);

  const toForm = React.useCallback(
    (s: NonNullable<typeof school>) => ({
      name: s.name, address: s.address, wilaya: s.wilaya, contactEmail: s.contactEmail, contactPhone: s.contactPhone,
    }),
    [],
  );
  const edit = useEditMode(() => {
    if (school) setFormData(toForm(school));
    setSaveError(null);
  });

  // Follow the saved school while reading; never overwrite what is being typed.
  React.useEffect(() => {
    if (school && !edit.editing) setFormData(toForm(school));
  }, [school, edit.editing, toForm]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateSchool.mutateAsync({ id: schoolId!, ...formData });
      edit.finishEditing();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }

  async function handleToggle() {
    if (!school) return;
    if (!(await confirm(schoolToggleConfirm(t, school)))) return;
    setToggleError(null);
    toggleSchool.mutate(
      { id: school.id, isActive: school.isActive },
      { onError: (err) => setToggleError(errorMessage(err, t)) }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back="/admin/schools" title={<span className="inline-block h-8 w-48 bg-hover rounded-md animate-pulse" />} />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back="/admin/schools" title={t('schools.title')} />
        <EmptyState message={t('schools.notFound')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        back="/admin/schools"
        title={school.name}
        description={
          <>
            {school.wilaya} · {t('schools.columns.createdAt')} <span dir="ltr">{formatDate(school.createdAt)}</span>
          </>
        }
        badge={
          <span className="inline-flex flex-wrap items-center gap-1">
            <StatusBadge variant={school.isActive ? 'success' : 'neutral'}>
              {school.isActive ? t('schools.active') : t('schools.inactive')}
            </StatusBadge>
            <TrialBadge school={school} />
          </span>
        }
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'info', label: t('schools.tabs.info'), icon: <Settings /> },
          { value: 'users', label: t('schools.tabs.users'), icon: <Users /> },
        ]}
      />

      {/* Info tab */}
      {activeTab === 'info' && (
        <>
          {/* Edit form */}
          <form onSubmit={handleSave}>
            <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-subsection font-semibold text-text-heading">{t('schools.detail.info')}</h2>
                <EditButton onClick={edit.startEditing} hidden={edit.editing} />
              </div>
              <ReadOnlyFieldset readOnly={!edit.editing}>
              <FormField label={t('schoolSettings.name')} htmlFor="sd-name" required>
                <Input id="sd-name" name="name" value={formData.name} onChange={handleChange} placeholder={t('schools.form.namePlaceholder')} />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                <FormField label={t('schoolSettings.address')} htmlFor="sd-address" required>
                  <Input id="sd-address" name="address" value={formData.address} onChange={handleChange} placeholder={t('schoolSettings.addressPlaceholder')} />
                </FormField>
                <FormField label={t('schoolSettings.wilaya')} htmlFor="sd-wilaya" required>
                  <Input id="sd-wilaya" name="wilaya" value={formData.wilaya} onChange={handleChange} placeholder={t('schoolSettings.wilayaPlaceholder')} />
                </FormField>
                <FormField label={t('schoolSettings.contactEmail')} htmlFor="sd-email" required>
                  <Input id="sd-email" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleChange} placeholder={t('schoolSettings.contactEmailPlaceholder')} />
                </FormField>
                <FormField label={t('schoolSettings.contactPhone')} htmlFor="sd-phone" required>
                  <Input id="sd-phone" name="contactPhone" type="tel" value={formData.contactPhone} onChange={handleChange} placeholder={t('schoolSettings.contactPhonePlaceholder')} />
                </FormField>
              </div>
              </ReadOnlyFieldset>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-4 empty:hidden">
              {edit.editing && <EditFormActions saving={updateSchool.isPending} onCancel={edit.cancelEditing} />}

              {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
              {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
            </div>
          </form>

          <TrialSection school={school} />

          <DangerZone description={school.isActive ? t('schools.detail.deactivateWarning') : t('schools.detail.activateHint')}>
            <Button type="button" variant="secondary" onClick={handleToggle} disabled={toggleSchool.isPending}>
              {school.isActive
                ? <><ShieldOff className="w-4 h-4 text-danger" />{t('schools.deactivate')}</>
                : <><Shield className="w-4 h-4 text-success" />{t('schools.activate')}</>}
            </Button>
            <EntityDeleteButton
              entityType="schools"
              entityId={schoolId!}
              entityDisplayName={school.name}
              onDeleted={() => navigate('/admin/schools')}
              hidden={!!school.deletedAt}
            />
            <ErrorAlert message={toggleError} className="w-full" />
            {/* A trial over without subscribing: the school and all its data can go for good. */}
            {trialState(school) === 'ended' && (
              <div className="w-full border-t border-border pt-3 space-y-2">
                <p className="text-body text-text-secondary">{t('schools.trial.purgeHint')}</p>
                <Button type="button" variant="danger" onClick={() => setPurgeOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                  {t('schools.trial.purge')}
                </Button>
              </div>
            )}
          </DangerZone>
          <PurgeSchoolDialog school={school} open={purgeOpen} onOpenChange={setPurgeOpen} />
        </>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <UsersTab schoolId={schoolId!} />
      )}
      {confirmDialog}
    </div>
  );
}

/* ─── Users Tab ─── */

function UsersTab({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: users, isLoading } = useSchoolUsers(schoolId);
  const { data: school } = useSchoolDetail(schoolId);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const columns: Column<SchoolUser>[] = [
    {
      key: 'name',
      header: t('users.columns.name'),
      render: (u) => (
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label font-semibold ${avatarColor(`${u.firstName} ${u.lastName}`)}`}>
            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">{u.firstName} {u.lastName}</p>
            <p className="text-caption text-text-secondary" dir="ltr">{u.email || u.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.columns.role'),
      render: (u) => <RoleBadge role={u.role} detail={u.role === 'administrative' ? u.accessProfile?.name : null} />,
    },
    {
      key: 'isActive',
      header: t('users.columns.status'),
      render: (u) => (
        <StatusBadge variant={u.isActive ? 'success' : 'neutral'}>
          {u.isActive ? t('users.active') : t('users.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'preferredLanguage',
      header: t('users.columns.language'),
      render: (u) => (
        <span className="text-body text-text-secondary">{u.preferredLanguage === 'ar' ? 'العربية' : 'Français'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: t('users.columns.joined'),
      render: (u) => (
        <span className="text-caption text-text-secondary" dir="ltr">{formatDate(u.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body text-text-secondary">
          {t('schools.users.total', { count: (users ?? []).length })}
        </p>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" />
          {t('schools.users.invite')}
        </Button>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-hover rounded-md" />)}
          </div>
        </div>
      ) : (
        <DataTable<SchoolUser>
          columns={columns}
          data={users ?? []}
          keyExtractor={(u) => u.id}
          onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
          emptyMessage={t('schools.users.noUsers')}
        />
      )}

      <CreateUserDialog open={inviteOpen} onOpenChange={setInviteOpen} schoolId={schoolId} schoolName={school?.name} />
    </div>
  );
}

/* ─── Create User Dialog (super_admin) ─── */

function CreateUserDialog({
  open, onOpenChange, schoolId, schoolName,
}: { open: boolean; onOpenChange: (v: boolean) => void; schoolId: string; schoolName?: string }) {
  const { t } = useTranslation();
  const createUser = useCreateUserInSchool(schoolId, schoolName);
  const emptyForm = { firstName: '', lastName: '', email: '', phone: '', role: 'teacher', preferredLanguage: 'fr' };
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const roleOptions = [
    { value: 'admin', label: t('users.roles.admin') },
    { value: 'administrative', label: t('users.roles.administrative') },
    { value: 'teacher', label: t('users.roles.teacher') },
    { value: 'parent', label: t('users.roles.parent') },
    { value: 'staff', label: t('users.roles.staff') },
  ];
  const langOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'ar', label: 'العربية' },
  ];

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }
  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.firstName || !form.lastName) {
      setError(t('schools.users.allFieldsRequired'));
      return;
    }
    // One of the two: without an email, the person signs in with the phone number.
    if (form.role !== 'staff' && !form.email.trim() && !form.phone.trim()) {
      setError(t('loginId.required'));
      return;
    }
    try {
      // An employee without access to the app has no email to sign in with.
      await createUser.mutateAsync(form.role === 'staff' ? { ...form, email: '' } : form);
      setSuccess(true);
      setForm(emptyForm);
      setTimeout(() => { setSuccess(false); onOpenChange(false); }, 2000);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm(emptyForm); setError(null); setSuccess(false); } onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('schools.users.createTitle')}</DialogTitle>
          <DialogDescription>{t('schools.users.createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('users.detail.firstName')} htmlFor="cu-first" required>
              <Input id="cu-first" name="firstName" value={form.firstName} onChange={handleChange} />
            </FormField>
            <FormField label={t('users.detail.lastName')} htmlFor="cu-last" required>
              <Input id="cu-last" name="lastName" value={form.lastName} onChange={handleChange} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('users.detail.email')} htmlFor="cu-email">
              <Input id="cu-email" name="email" type="email" dir="ltr" value={form.email} onChange={handleChange} placeholder="user@example.dz" />
            </FormField>
            <FormField label={t('loginId.phone')} htmlFor="cu-phone">
              <Input id="cu-phone" name="phone" type="tel" dir="ltr" value={form.phone} onChange={handleChange} placeholder="0555 12 34 56" />
            </FormField>
          </div>
          <p className="text-caption text-text-secondary mb-2">{t(form.role === 'staff' ? 'users.staffRoleHint' : 'loginId.hint')}</p>
          <p className="text-caption text-text-secondary mb-2">{t('users.create_form.defaultPasswordHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormSelect label={t('users.columns.role')} name="role" value={form.role} onChange={handleSelect} options={roleOptions} />
            <FormSelect label={t('users.columns.language')} name="preferredLanguage" value={form.preferredLanguage} onChange={handleSelect} options={langOptions} />
          </div>
          {error && <p className="text-body text-danger mb-4">{error}</p>}
          {success && <p className="text-body text-success mb-4">{t('schools.users.created')}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
