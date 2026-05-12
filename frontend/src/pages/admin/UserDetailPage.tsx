import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Shield, ShieldOff, Save } from 'lucide-react';
import { Button, StatusBadge } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { useUser, useUpdateUser, useToggleUserActive } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { Building2 } from 'lucide-react';

export function UserDetailPage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { user: currentUser } = useAuth();
  const { data: user, isLoading } = useUser(userId!);
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();

  const [formData, setFormData] = React.useState({
    first_name: '',
    last_name: '',
    role: '',
    preferred_language: '',
  });
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        preferred_language: user.preferred_language,
      });
    }
  }, [user]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateUser.mutateAsync({ id: userId!, ...formData });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleToggleActive() {
    if (!user) return;
    try {
      await toggleActive.mutateAsync({ id: user.id, isActive: user.is_active });
    } catch {
      // ignore — handled by React Query
    }
  }

  const roleOptions = [
    { value: 'admin', label: t('users.roles.admin') },
    { value: 'teacher', label: t('users.roles.teacher') },
    { value: 'parent', label: t('users.roles.parent') },
  ];

  const languageOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'ar', label: 'العربية' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-hover rounded-md w-1/2" />
          <div className="h-10 bg-hover rounded-md w-1/2" />
          <div className="h-10 bg-hover rounded-md w-1/3" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('users.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="flex-1">
          <h1 className="text-page-title font-semibold text-text-heading">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-body text-text-secondary">{user.email}</p>
        </div>
        <StatusBadge variant={user.is_active ? 'present' : 'cancelled'}>
          {user.is_active ? t('users.active') : t('users.inactive')}
        </StatusBadge>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading">
            {t('users.detail.profile')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <FormField label={t('users.detail.firstName')} htmlFor="u-first-name" required>
              <Input
                id="u-first-name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
              />
            </FormField>

            <FormField label={t('users.detail.lastName')} htmlFor="u-last-name" required>
              <Input
                id="u-last-name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
              />
            </FormField>

            <FormField label={t('users.columns.role')} htmlFor="u-role">
              <FormSelect
                label=""
                name="role"
                value={formData.role}
                onChange={handleSelectChange}
                options={roleOptions}
              />
            </FormField>

            <FormField label={t('users.columns.language')} htmlFor="u-lang">
              <FormSelect
                label=""
                name="preferred_language"
                value={formData.preferred_language}
                onChange={handleSelectChange}
                options={languageOptions}
              />
            </FormField>
          </div>

          <FormField label={t('users.detail.email')} htmlFor="u-email">
            <Input id="u-email" value={user.email} disabled className="opacity-60 cursor-not-allowed" />
          </FormField>

          <p className="text-caption text-text-secondary">
            {t('users.detail.joined')}: {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* School — visible to super_admin only */}
        {currentUser?.role === 'super_admin' && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-3">
            <h2 className="text-subsection font-semibold text-text-heading flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {t('users.detail.school')}
            </h2>
            {user.school ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body font-medium text-foreground">{user.school.name}</p>
                  <p className="text-caption text-text-secondary">
                    {t(`schoolSettings.types.${user.school.schoolType}`)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/admin/schools/${user.school!.id}`)}
                >
                  {t('users.detail.viewSchool')}
                </Button>
              </div>
            ) : (
              <p className="text-body text-text-secondary">{t('users.detail.noSchool')}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="submit" disabled={updateUser.isPending}>
            <Save className="w-4 h-4" />
            {updateUser.isPending ? t('common.loading') : t('common.save')}
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={toggleActive.isPending}
            onClick={handleToggleActive}
          >
            {user.is_active ? (
              <><ShieldOff className="w-4 h-4 text-danger" /> {t('users.deactivate')}</>
            ) : (
              <><Shield className="w-4 h-4 text-success" /> {t('users.activate')}</>
            )}
          </Button>

          {saveSuccess && (
            <span className="text-body text-success animate-fade-in">{t('common.saved')}</span>
          )}
          {saveError && (
            <span className="text-body text-danger animate-fade-in">{saveError}</span>
          )}
        </div>
      </form>
    </div>
  );
}
