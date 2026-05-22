import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Power, PowerOff } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SchoolItem {
  id: string;
  name: string;
  address: string;
  wilaya: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
}

export function useSchoolsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['schools-list'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/schools');
      const raw = res.data;
      if (Array.isArray(raw)) return raw as SchoolItem[];
      if (raw && typeof raw === 'object' && 'schools' in (raw as object)) {
        return (raw as { schools: SchoolItem[] }).schools;
      }
      return [];
    },
    enabled: user?.role === 'super_admin',
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string; address: string; wilaya: string; contactEmail: string; contactPhone: string;
      director: { firstName: string; lastName: string; email: string; preferredLanguage: string };
    }) => {
      const res = await apiClient.post('/schools', data);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create school');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
    },
  });
}

export function useToggleSchoolActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = isActive ? `/schools/${id}/deactivate` : `/schools/${id}/activate`;
      const res = await apiClient.patch(endpoint);
      if (!res.success) throw new Error(res.error?.message || 'Failed to update school status');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
      queryClient.invalidateQueries({ queryKey: ['school-detail'] });
    },
  });
}

export function SchoolsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: schools, isLoading } = useSchoolsList();
  const toggleSchool = useToggleSchoolActive();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  if (user?.role !== 'super_admin') {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">{t('schools.title')}</h1>
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-body text-text-secondary">{t('schools.superAdminOnly')}</p>
        </div>
      </div>
    );
  }

  const columns: Column<SchoolItem>[] = [
    {
      key: 'name',
      header: t('schools.columns.name'),
      sortable: true,
      render: (school) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-muted)] text-primary flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-body font-medium text-foreground">{school.name}</p>
            <p className="text-caption text-text-secondary">{school.wilaya}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contactEmail',
      header: t('schools.columns.contact'),
      render: (school) => (
        <div>
          <p className="text-body text-foreground">{school.contactEmail}</p>
          <p className="text-caption text-text-secondary">{school.contactPhone}</p>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: t('schools.columns.status'),
      render: (school) => (
        <StatusBadge variant={school.isActive ? 'present' : 'cancelled'}>
          {school.isActive ? t('schools.active') : t('schools.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: t('schools.columns.createdAt'),
      sortable: true,
      render: (school) => (
        <span className="text-caption text-text-secondary">
          {new Date(school.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (school) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleSchool.mutate(
                { id: school.id, isActive: school.isActive },
                { onError: (err) => setActionError(err instanceof Error ? err.message : 'Error') }
              );
            }}
            disabled={toggleSchool.isPending}
            aria-label={school.isActive ? t('schools.deactivate') : t('schools.activate')}
            title={school.isActive ? t('schools.deactivate') : t('schools.activate')}
          >
            {school.isActive ? (
              <PowerOff className="w-4 h-4 text-danger" />
            ) : (
              <Power className="w-4 h-4 text-success" />
            )}
          </Button>
        </div>
      ),
      className: 'w-20',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-page-title font-semibold text-text-heading">{t('schools.title')}</h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title font-semibold text-text-heading">{t('schools.title')}</h1>
          <p className="text-caption text-text-secondary mt-1">
            {t('schools.count', { count: (schools ?? []).length })}
          </p>
        </div>
        <CreateButton label={t('schools.create')} onClick={() => setCreateDialogOpen(true)} />
      </div>

      {actionError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-body text-danger flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-danger hover:opacity-70 text-lg leading-none">&times;</button>
        </div>
      )}

      <DataTable<SchoolItem>
        columns={columns}
        data={schools ?? []}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => navigate(`/admin/schools/${s.id}`)}
        emptyMessage={t('schools.noSchools')}
      />

      <CreateSchoolDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}

function CreateSchoolDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const createSchool = useCreateSchool();
  const emptySchool = { name: '', address: '', wilaya: '', contactEmail: '', contactPhone: '' };
  const emptyDirector = { firstName: '', lastName: '', email: '', preferredLanguage: 'fr' };
  const [formData, setFormData] = React.useState(emptySchool);
  const [director, setDirector] = React.useState(emptyDirector);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [createError, setCreateError] = React.useState<string | null>(null);

  function resetForm() {
    setFormData(emptySchool);
    setDirector(emptyDirector);
    setErrors({});
    setCreateError(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleDirectorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setDirector((prev) => ({ ...prev, [name]: value }));
    if (errors[`d_${name}`]) setErrors((prev) => ({ ...prev, [`d_${name}`]: '' }));
  }

  function handleDirectorSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDirector((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = t('schools.form.nameRequired');
    if (!formData.address.trim()) newErrors.address = t('schools.form.addressRequired');
    if (!formData.wilaya.trim()) newErrors.wilaya = t('schools.form.wilayaRequired');
    if (!formData.contactEmail.trim()) newErrors.contactEmail = t('schools.form.emailRequired');
    if (!formData.contactPhone.trim()) newErrors.contactPhone = t('schools.form.phoneRequired');
    if (!director.firstName.trim()) newErrors.d_firstName = t('schools.form.director.firstNameRequired');
    if (!director.lastName.trim()) newErrors.d_lastName = t('schools.form.director.lastNameRequired');
    if (!director.email.trim()) newErrors.d_email = t('schools.form.director.emailRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setCreateError(null);
    try {
      await createSchool.mutateAsync({ ...formData, director });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  const langOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'ar', label: 'العربية' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('schools.form.createTitle')}</DialogTitle>
          <DialogDescription>{t('schools.form.createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>

          {/* School info */}
          <FormField label={t('schools.form.name')} htmlFor="s-name" error={errors.name} required>
            <Input id="s-name" name="name" value={formData.name} onChange={handleChange} placeholder={t('schools.form.namePlaceholder')} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('schoolSettings.address')} htmlFor="s-address" error={errors.address} required>
              <Input id="s-address" name="address" value={formData.address} onChange={handleChange} placeholder={t('schoolSettings.addressPlaceholder')} />
            </FormField>
            <FormField label={t('schoolSettings.wilaya')} htmlFor="s-wilaya" error={errors.wilaya} required>
              <Input id="s-wilaya" name="wilaya" value={formData.wilaya} onChange={handleChange} placeholder={t('schoolSettings.wilayaPlaceholder')} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label={t('schoolSettings.contactEmail')} htmlFor="s-email" error={errors.contactEmail} required>
              <Input id="s-email" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleChange} placeholder={t('schoolSettings.contactEmailPlaceholder')} />
            </FormField>
            <FormField label={t('schoolSettings.contactPhone')} htmlFor="s-phone" error={errors.contactPhone} required>
              <Input id="s-phone" name="contactPhone" type="tel" value={formData.contactPhone} onChange={handleChange} placeholder={t('schoolSettings.contactPhonePlaceholder')} />
            </FormField>
          </div>

          {/* Director section */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-subsection font-semibold text-text-heading mb-3">
              {t('schools.form.director.title')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormField label={t('users.detail.firstName')} htmlFor="d-first" error={errors.d_firstName} required>
                <Input id="d-first" name="firstName" value={director.firstName} onChange={handleDirectorChange} />
              </FormField>
              <FormField label={t('users.detail.lastName')} htmlFor="d-last" error={errors.d_lastName} required>
                <Input id="d-last" name="lastName" value={director.lastName} onChange={handleDirectorChange} />
              </FormField>
            </div>
            <FormField label={t('users.detail.email')} htmlFor="d-email" error={errors.d_email} required>
              <Input id="d-email" name="email" type="email" value={director.email} onChange={handleDirectorChange} placeholder="directeur@ecole.dz" />
            </FormField>
            <div className="flex items-center gap-2">
              <FormSelect label={t('users.columns.language')} name="preferredLanguage" value={director.preferredLanguage} onChange={handleDirectorSelectChange} options={langOptions} />
            </div>
            <p className="text-caption text-text-secondary">{t('users.create_form.defaultPasswordHint')}</p>
          </div>

          {createError && <p className="text-body text-danger mt-3">{createError}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => { resetForm(); onOpenChange(false); }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={createSchool.isPending}>
              {createSchool.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
