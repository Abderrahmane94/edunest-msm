import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/formatters';
import { Building2, Shield, ShieldOff } from 'lucide-react';
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
import { apiClient, apiError } from '@/lib/api-client';
import { announceNewAccount, type CreatedAccount } from '@/lib/newAccount';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSchoolsList, type SchoolItem } from '@/hooks/useSchools';
import { ErrorAlert, FilterBar, ListSkeleton, PageHeader, useConfirm, type ConfirmOptions } from '@/components/ui';
import type { TFunction } from 'i18next';

/** A new school on trial: this many days, then closed until it subscribes. */
const TRIAL_DAYS = 15;

/** Where a school is in its trial, if it is on one: still running (until when) or over. */
export function trialState(school: { trialEndsAt?: string | null }): 'running' | 'ended' | null {
  if (!school.trialEndsAt) return null;
  return new Date(school.trialEndsAt).getTime() > Date.now() ? 'running' : 'ended';
}

/** The badge of a school on trial. */
export function TrialBadge({ school }: { school: { trialEndsAt?: string | null } }) {
  const { t } = useTranslation();
  const state = trialState(school);
  if (!state) return null;
  return state === 'running' ? (
    <StatusBadge variant="warning">{t('schools.trial.badgeUntil', { date: `⁨${formatDate(school.trialEndsAt!)}⁩` })}</StatusBadge>
  ) : (
    <StatusBadge variant="danger">{t('schools.trial.badgeEnded')}</StatusBadge>
  );
}

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string; address: string; wilaya: string; contactEmail: string; contactPhone: string;
      director: { firstName: string; lastName: string; email: string; phone: string; preferredLanguage: string };
      trialDays?: number;
    }) => {
      const res = await apiClient.post<{ director?: CreatedAccount }>('/schools', data);
      if (!res.success) throw apiError(res.error, 'Failed to create school');
      announceNewAccount(res.data?.director, { role: 'admin', schoolName: data.name });
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
      if (!res.success) throw apiError(res.error, 'Failed to update school status');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools-list'] });
      queryClient.invalidateQueries({ queryKey: ['school-detail'] });
    },
  });
}

/** The question asked before a school is deactivated or reactivated. */
export function schoolToggleConfirm(t: TFunction, school: { name: string; isActive: boolean }): ConfirmOptions {
  return school.isActive
    ? {
        title: t('confirmations.school.deactivateTitle', { name: school.name }),
        description: t('confirmations.school.deactivateDescription'),
        confirmLabel: t('schools.deactivate'),
        tone: 'danger',
      }
    : {
        title: t('confirmations.school.activateTitle', { name: school.name }),
        description: t('confirmations.school.activateDescription'),
        confirmLabel: t('schools.activate'),
        tone: 'default',
      };
}

export function SchoolsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Said by the page left (a school erased for good).
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const { data: schools, isLoading } = useSchoolsList();
  const toggleSchool = useToggleSchoolActive();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // ─── Filters (the platform has few schools, so filter here) ───
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'' | 'active' | 'inactive'>('');
  const [wilayaFilter, setWilayaFilter] = React.useState('');

  const wilayaOptions = React.useMemo(
    () => [...new Set((schools ?? []).map((s) => s.wilaya).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [schools],
  );

  const filteredSchools = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (schools ?? []).filter((s) => {
      if (needle && ![s.name, s.wilaya, s.contactEmail, s.contactPhone].some((v) => (v ?? '').toLowerCase().includes(needle))) {
        return false;
      }
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (wilayaFilter && s.wilaya !== wilayaFilter) return false;
      return true;
    });
  }, [schools, search, statusFilter, wilayaFilter]);

  const hasFilters = !!(search || statusFilter || wilayaFilter);

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
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge variant={school.isActive ? 'success' : 'neutral'}>
            {school.isActive ? t('schools.active') : t('schools.inactive')}
          </StatusBadge>
          <TrialBadge school={school} />
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('schools.columns.createdAt'),
      sortable: true,
      render: (school) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {formatDate(school.createdAt)}
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
            onClick={async (e) => {
              e.stopPropagation();
              if (!(await confirm(schoolToggleConfirm(t, school)))) return;
              toggleSchool.mutate(
                { id: school.id, isActive: school.isActive },
                { onError: (err) => setActionError(errorMessage(err, t)) }
              );
            }}
            disabled={toggleSchool.isPending}
            aria-label={school.isActive ? t('schools.deactivate') : t('schools.activate')}
            title={school.isActive ? t('schools.deactivate') : t('schools.activate')}
          >
            {school.isActive ? (
              <ShieldOff className="w-4 h-4 text-danger" />
            ) : (
              <Shield className="w-4 h-4 text-success" />
            )}
          </Button>
        </div>
      ),
      className: 'w-20',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDialog}
      <PageHeader
        title={t('schools.title')}
        description={t('schools.count', { count: (schools ?? []).length })}
        actions={<CreateButton label={t('schools.create')} onClick={() => setCreateDialogOpen(true)} />}
      />

      {notice && <p role="status" className="text-body text-success">{notice}</p>}
      <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          {(schools ?? []).length > 0 && (
            <FilterBar
              search={{ onSearch: setSearch, placeholder: t('schools.filters.searchPlaceholder'), defaultValue: search }}
              activeCount={[statusFilter, wilayaFilter].filter(Boolean).length}
              summary={t('schools.filters.summary', { count: filteredSchools.length })}
              onReset={() => {
                setStatusFilter('');
                setWilayaFilter('');
              }}
              columns={2}
            >
              <FormSelect
                label={t('schools.filters.status')}
                name="schools-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
                options={[
                  { value: '', label: t('schools.filters.allStatuses') },
                  { value: 'active', label: t('schools.active') },
                  { value: 'inactive', label: t('schools.inactive') },
                ]}
              />
              <FormSelect
                label={t('schools.filters.wilaya')}
                name="schools-filter-wilaya"
                value={wilayaFilter}
                onChange={(e) => setWilayaFilter(e.target.value)}
                options={[
                  { value: '', label: t('schools.filters.allWilayas') },
                  ...wilayaOptions.map((w) => ({ value: w, label: w })),
                ]}
              />
            </FilterBar>
          )}
          <DataTable<SchoolItem>
            columns={columns}
            data={filteredSchools}
            keyExtractor={(s) => s.id}
            onRowClick={(s) => navigate(`/admin/schools/${s.id}`)}
            emptyMessage={hasFilters ? t('schools.filters.noMatch') : t('schools.noSchools')}
          />
        </>
      )}

      <CreateSchoolDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}

function CreateSchoolDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const createSchool = useCreateSchool();
  const emptySchool = { name: '', address: '', wilaya: '', contactEmail: '', contactPhone: '' };
  const emptyDirector = { firstName: '', lastName: '', email: '', phone: '', preferredLanguage: 'fr' };
  const [formData, setFormData] = React.useState(emptySchool);
  const [director, setDirector] = React.useState(emptyDirector);
  const [trial, setTrial] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [createError, setCreateError] = React.useState<string | null>(null);

  function resetForm() {
    setFormData(emptySchool);
    setDirector(emptyDirector);
    setTrial(false);
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
    if (!director.email.trim() && !director.phone.trim()) newErrors.d_email = t('loginId.required');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setCreateError(null);
    try {
      await createSchool.mutateAsync({ ...formData, director, ...(trial && { trialDays: TRIAL_DAYS }) });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setCreateError(errorMessage(err, t));
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

          {/* On trial: closed at its end (data kept) until it subscribes. */}
          <label className="mt-1 flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
            <input type="checkbox" name="trial" className="mt-0.5 w-4 h-4 rounded border-border text-primary" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
            <span>
              <span className="block text-body font-medium text-foreground">{t('schools.trial.formLabel', { count: TRIAL_DAYS })}</span>
              <span className="block text-caption text-text-secondary">{t('schools.trial.formHint')}</span>
            </span>
          </label>

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
            {/* One of the two: without an email, the director signs in with the phone number. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormField label={t('users.detail.email')} htmlFor="d-email" error={errors.d_email}>
                <Input id="d-email" name="email" type="email" dir="ltr" value={director.email} onChange={handleDirectorChange} placeholder="directeur@ecole.dz" />
              </FormField>
              <FormField label={t('loginId.phone')} htmlFor="d-phone">
                <Input id="d-phone" name="phone" type="tel" dir="ltr" value={director.phone} onChange={handleDirectorChange} placeholder="0555 12 34 56" />
              </FormField>
            </div>
            <p className="text-caption text-text-secondary -mt-2 mb-3">{t('loginId.hint')}</p>
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
