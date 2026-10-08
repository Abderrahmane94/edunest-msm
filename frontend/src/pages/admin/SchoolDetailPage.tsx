import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Shield, ShieldOff, Users, UserPlus, Settings } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { Button, DangerZone, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, EntityDeleteButton, ErrorAlert, Input, ListSkeleton, PageHeader, RoleBadge, StatusBadge, Tabs, useConfirm } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { apiClient, apiError } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolToggleConfirm, useToggleSchoolActive } from './SchoolsPage';
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

interface SchoolUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
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

function useCreateUserInSchool(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; role: string; preferredLanguage: string }) => {
      const res = await apiClient.post(`/schools/${schoolId}/users`, data);
      if (!res.success) throw apiError(res.error, 'Failed to create user');
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

  React.useEffect(() => {
    if (school) {
      setFormData({
        name: school.name, address: school.address,
        wilaya: school.wilaya, contactEmail: school.contactEmail, contactPhone: school.contactPhone,
      });
    }
  }, [school]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateSchool.mutateAsync({ id: schoolId!, ...formData });
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
          <StatusBadge variant={school.isActive ? 'success' : 'neutral'}>
            {school.isActive ? t('schools.active') : t('schools.inactive')}
          </StatusBadge>
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
              <h2 className="text-subsection font-semibold text-text-heading">{t('schools.detail.info')}</h2>
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
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-4">
              <Button type="submit" disabled={updateSchool.isPending}>
                <Save className="w-4 h-4" />{updateSchool.isPending ? t('common.loading') : t('common.save')}
              </Button>

              {saveSuccess && <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>}
              {saveError && <span className="text-body text-danger animate-fade-in">{saveError}</span>}
            </div>
          </form>

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
          </DangerZone>
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
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const columns: Column<SchoolUser>[] = [
    {
      key: 'name',
      header: t('users.columns.name'),
      render: (u) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-primary flex items-center justify-center text-label font-semibold">
            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
          </div>
          <div>
            <p className="text-body font-medium text-foreground">{u.firstName} {u.lastName}</p>
            <p className="text-caption text-text-secondary">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.columns.role'),
      render: (u) => <RoleBadge role={u.role} />,
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

      <CreateUserDialog open={inviteOpen} onOpenChange={setInviteOpen} schoolId={schoolId} />
    </div>
  );
}

/* ─── Create User Dialog (super_admin) ─── */

function CreateUserDialog({
  open, onOpenChange, schoolId,
}: { open: boolean; onOpenChange: (v: boolean) => void; schoolId: string }) {
  const { t } = useTranslation();
  const createUser = useCreateUserInSchool(schoolId);
  const emptyForm = { firstName: '', lastName: '', email: '', role: 'teacher', preferredLanguage: 'fr' };
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const roleOptions = [
    { value: 'admin', label: t('users.roles.admin') },
    { value: 'teacher', label: t('users.roles.teacher') },
    { value: 'parent', label: t('users.roles.parent') },
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
    if (!form.firstName || !form.lastName || !form.email) {
      setError(t('schools.users.allFieldsRequired'));
      return;
    }
    try {
      await createUser.mutateAsync(form);
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
          <FormField label={t('users.detail.email')} htmlFor="cu-email" required>
            <Input id="cu-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="user@example.dz" />
          </FormField>
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
