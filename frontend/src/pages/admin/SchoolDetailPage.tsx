import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Power, PowerOff, Users, UserPlus, Settings } from 'lucide-react';
import { Button, StatusBadge, DataTable, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type SchoolItem, useToggleSchoolActive } from './SchoolsPage';

type Tab = 'info' | 'users';

/* ─── Hooks ─── */

function useSchoolDetail(id: string) {
  return useQuery({
    queryKey: ['school-detail', id],
    queryFn: async () => {
      const res = await apiClient.get<SchoolItem>(`/schools/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'School not found');
      return res.data as SchoolItem;
    },
    enabled: !!id,
  });
}

function useUpdateSchoolAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; schoolType?: string; address?: string; wilaya?: string; contactEmail?: string; contactPhone?: string }) => {
      const res = await apiClient.put(`/schools/${id}`, data);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update school');
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
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create user');
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

  const [activeTab, setActiveTab] = React.useState<Tab>('info');
  const [formData, setFormData] = React.useState({
    name: '', schoolType: 'kindergarten', address: '', wilaya: '', contactEmail: '', contactPhone: '',
  });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [toggleError, setToggleError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (school) {
      setFormData({
        name: school.name, schoolType: school.schoolType, address: school.address,
        wilaya: school.wilaya, contactEmail: school.contactEmail, contactPhone: school.contactPhone,
      });
    }
  }, [school]);

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
      await updateSchool.mutateAsync({ id: schoolId!, ...formData });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  function handleToggle() {
    if (!school) return;
    setToggleError(null);
    toggleSchool.mutate(
      { id: school.id, isActive: school.isActive },
      { onError: (err) => setToggleError(err instanceof Error ? err.message : t('common.error')) }
    );
  }

  const typeOptions = [
    { value: 'kindergarten', label: t('schoolSettings.types.kindergarten') },
    { value: 'primary', label: t('schoolSettings.types.primary') },
    { value: 'secondary', label: t('schoolSettings.types.secondary') },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md" /><div className="h-10 bg-hover rounded-md w-1/2" />
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/schools')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('schools.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/schools')}>
          <ArrowLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-page-title font-semibold text-text-heading">{school.name}</h1>
          <p className="text-body text-text-secondary">{school.wilaya} · {t(`schoolSettings.types.${school.schoolType}`)}</p>
        </div>
        <StatusBadge variant={school.isActive ? 'present' : 'cancelled'}>
          {school.isActive ? t('schools.active') : t('schools.inactive')}
        </StatusBadge>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === 'info' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('info')}
        >
          <Settings className="w-4 h-4" />
          {t('schools.tabs.info')}
        </Button>
        <Button
          variant={activeTab === 'users' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('users')}
        >
          <Users className="w-4 h-4" />
          {t('schools.tabs.users')}
        </Button>
      </div>

      {/* Info tab */}
      {activeTab === 'info' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-caption text-text-secondary">{t('schools.detail.schoolId')}</p>
              <p className="text-caption font-mono text-foreground mt-1 truncate">{school.id}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-caption text-text-secondary">{t('schools.columns.createdAt')}</p>
              <p className="text-body font-medium text-foreground mt-1">{new Date(school.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-caption text-text-secondary">{t('schools.columns.status')}</p>
              <p className="text-body font-medium mt-1">
                {school.isActive
                  ? <span className="text-success">{t('schools.active')}</span>
                  : <span className="text-danger">{t('schools.inactive')}</span>}
              </p>
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={handleSave}>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-subsection font-semibold text-text-heading">{t('schools.detail.info')}</h2>
              <FormField label={t('schoolSettings.name')} htmlFor="sd-name" required>
                <Input id="sd-name" name="name" value={formData.name} onChange={handleChange} placeholder={t('schools.form.namePlaceholder')} />
              </FormField>
              <FormSelect label={t('schoolSettings.type')} name="schoolType" value={formData.schoolType} onChange={handleSelectChange} options={typeOptions} />
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

          {/* Activate / Deactivate */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-3">
            <h2 className="text-subsection font-semibold text-text-heading">{t('schools.detail.accessControl')}</h2>
            <p className="text-body text-text-secondary">
              {school.isActive ? t('schools.detail.deactivateWarning') : t('schools.detail.activateHint')}
            </p>
            {toggleError && <p className="text-body text-danger">{toggleError}</p>}
            <Button
              variant="secondary"
              onClick={handleToggle}
              disabled={toggleSchool.isPending}
              className={school.isActive ? 'border-danger text-danger hover:bg-danger/10' : ''}
            >
              {school.isActive
                ? <><PowerOff className="w-4 h-4" />{t('schools.deactivate')}</>
                : <><Power className="w-4 h-4 text-success" />{t('schools.activate')}</>}
            </Button>
          </div>
        </>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <UsersTab schoolId={schoolId!} />
      )}
    </div>
  );
}

/* ─── Users Tab ─── */

function UsersTab({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: users, isLoading } = useSchoolUsers(schoolId);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-[#EDE9FE] text-[#5B21B6]',
    teacher: 'bg-[#DBEAFE] text-[#1D4ED8]',
    parent: 'bg-[#FCE7F3] text-[#9D174D]',
  };

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
      render: (u) => (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-micro font-medium ${ROLE_COLORS[u.role] ?? 'bg-subtle text-text-secondary'}`}>
          {t(`users.roles.${u.role}`)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: t('users.columns.status'),
      render: (u) => (
        <StatusBadge variant={u.isActive ? 'present' : 'cancelled'}>
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
        <span className="text-caption text-text-secondary">{new Date(u.createdAt).toLocaleDateString()}</span>
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
      setError(err instanceof Error ? err.message : t('common.error'));
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
