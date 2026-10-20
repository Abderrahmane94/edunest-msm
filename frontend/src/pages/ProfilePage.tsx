import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, KeyRound, Trash2, Upload } from 'lucide-react';
import { Avatar, Button, ErrorAlert, Input, ListSkeleton, PageHeader, RoleBadge } from '@/components/ui';
import { FormField } from '@/components/forms';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errorMessage';
import { apiClient, apiError } from '@/lib/api-client';
import { useMyProfile, useRemoveMyAvatar, useUpdateMyProfile, useUploadMyAvatar } from '@/hooks/useMyProfile';
import { MyChildrenPhotos } from '@/components/MyChildrenPhotos';
import { PushNotificationsCard } from '@/components/PushNotifications';

/**
 * "Mon profil", for every role: one's own photo, names and phone. The email
 * is shown but changed only by the director (it is how one signs in).
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile, isLoading, isError, error } = useMyProfile();
  const update = useUpdateMyProfile();
  const upload = useUploadMyAvatar();
  const remove = useRemoveMyAvatar();

  const [form, setForm] = React.useState({ firstName: '', lastName: '', phone: '' });
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (profile) setForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone ?? '' });
  }, [profile]);

  const changed =
    !!profile &&
    (form.firstName.trim() !== profile.firstName ||
      form.lastName.trim() !== profile.lastName ||
      form.phone.trim() !== (profile.phone ?? ''));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setProblem(errorMessage(err, t));
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem(null);
    if (file.size > 5 * 1024 * 1024) {
      setProblem(t('myProfile.photoTooLarge'));
      return;
    }
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setProblem(errorMessage(err, t));
    }
  }

  async function handleRemovePhoto() {
    setProblem(null);
    try {
      await remove.mutateAsync();
    } catch (err) {
      setProblem(errorMessage(err, t));
    }
  }

  const photoBusy = upload.isPending || remove.isPending;
  const fullName = `${form.firstName} ${form.lastName}`.trim() || user?.email || '';

  return (
    // The parent pages have no frame of their own around them.
    <div className={user?.role === 'parent' ? 'px-4 py-6' : undefined}>
      <div className="mx-auto w-full max-w-[600px] space-y-4 animate-fade-in">
        <PageHeader title={t('myProfile.title')} description={t('myProfile.description')} />

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError || !profile ? (
          <ErrorAlert message={errorMessage(error, t)} />
        ) : (
          <>
            {problem && <ErrorAlert message={problem} />}

            <section className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={photoBusy}
                  className="relative rounded-full group focus-visible:outline-none focus-visible:shadow-focus-ring"
                  aria-label={t('myProfile.changePhoto')}
                >
                  <Avatar src={profile.avatarUrl} name={fullName} size="lg" className="!w-20 !h-20 !text-section" />
                  <span className="absolute inset-0 rounded-full bg-[rgba(15,23,42,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[var(--color-text-inverse)]" />
                  </span>
                </button>
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={photoBusy}>
                      <Upload className="w-4 h-4" />
                      {upload.isPending ? t('myProfile.uploading') : t(profile.avatarUrl ? 'myProfile.changePhoto' : 'myProfile.addPhoto')}
                    </Button>
                    {profile.avatarUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto} disabled={photoBusy}>
                        <Trash2 className="w-4 h-4" />
                        {t('myProfile.removePhoto')}
                      </Button>
                    )}
                  </div>
                  <p className="text-caption text-text-secondary">{t('myProfile.photoHint')}</p>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhoto}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>
            </section>

            {user?.role === 'parent' && <MyChildrenPhotos />}

            <PushNotificationsCard />

            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <FormField label={t('myProfile.firstName')} htmlFor="firstName" required>
                  <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} required maxLength={100} autoComplete="given-name" />
                </FormField>
                <FormField label={t('myProfile.lastName')} htmlFor="lastName" required>
                  <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} required maxLength={100} autoComplete="family-name" />
                </FormField>
                <FormField label={t('myProfile.phone')} htmlFor="phone">
                  <Input id="phone" name="phone" type="tel" dir="ltr" value={form.phone} onChange={handleChange} maxLength={20} autoComplete="tel" />
                </FormField>
                <FormField label={t('myProfile.email')} htmlFor="email">
                  <Input id="email" value={profile.email ?? t('loginId.noEmail')} readOnly disabled dir={profile.email ? 'ltr' : undefined} />
                </FormField>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
                <div className="flex items-center gap-2 text-caption text-text-secondary">
                  <span>{t('myProfile.role')}</span>
                  <RoleBadge role={profile.role} />
                </div>
                <div className="flex items-center gap-3">
                  {saved && !changed && <span className="text-caption text-[var(--color-success-ink)]">{t('myProfile.saved')}</span>}
                  <Button type="submit" disabled={!changed || update.isPending || !form.firstName.trim() || !form.lastName.trim()}>
                    {update.isPending ? t('myProfile.saving') : t('myProfile.save')}
                  </Button>
                </div>
              </div>
              <p className="text-caption text-text-secondary mt-4">{t('myProfile.emailHint')}</p>
            </form>

            <PasswordSection />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A new password, on proof of the current one. The account's other devices
 * are signed out; this one goes on with the new session the server gives.
 */
function PasswordSection() {
  const { t } = useTranslation();
  const { setTokens } = useAuth();
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [problem, setProblem] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDone(false);
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setDone(false);
    if (form.next.length < 8) return setProblem(t('auth.changePassword.minLength'));
    if (form.next !== form.confirm) return setProblem(t('auth.changePassword.mismatch'));
    setBusy(true);
    try {
      const res = await apiClient.post<{ accessToken: string; refreshToken?: string }>('/users/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      });
      if (!res.success || !res.data) {
        if (res.error?.message === 'Current password is incorrect') return setProblem(t('myProfile.wrongCurrentPassword'));
        throw apiError(res.error, t('common.error'));
      }
      if (res.data.refreshToken) setTokens(res.data.accessToken, res.data.refreshToken);
      else localStorage.setItem('access_token', res.data.accessToken);
      setForm({ current: '', next: '', confirm: '' });
      setDone(true);
    } catch (err) {
      setProblem(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6">
      <h2 className="flex items-center gap-2 text-subsection font-semibold text-text-heading mb-1">
        <KeyRound className="w-4 h-4 text-text-secondary" />
        {t('myProfile.passwordTitle')}
      </h2>
      <p className="text-caption text-text-secondary mb-4">{t('myProfile.passwordHint')}</p>
      {problem && <ErrorAlert message={problem} className="mb-4" />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="sm:col-span-2">
          <FormField label={t('myProfile.currentPassword')} htmlFor="current" required>
            <Input id="current" name="current" type="password" value={form.current} onChange={handleChange} required autoComplete="current-password" />
          </FormField>
        </div>
        <FormField label={t('auth.changePassword.newPassword')} htmlFor="next" required>
          <Input id="next" name="next" type="password" value={form.next} onChange={handleChange} required minLength={8} maxLength={128} autoComplete="new-password" placeholder={t('auth.changePassword.newPasswordPlaceholder')} />
        </FormField>
        <FormField label={t('auth.changePassword.confirmPassword')} htmlFor="confirm" required>
          <Input id="confirm" name="confirm" type="password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" />
        </FormField>
      </div>
      <div className="flex items-center justify-end gap-3 mt-2">
        {done && <span className="text-caption text-[var(--color-success-ink)]">{t('myProfile.passwordChanged')}</span>}
        <Button type="submit" disabled={busy || !form.current || !form.next || !form.confirm}>
          {busy ? t('myProfile.saving') : t('myProfile.changePassword')}
        </Button>
      </div>
    </form>
  );
}
