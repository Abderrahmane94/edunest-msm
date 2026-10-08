import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/layout/AuthShell';
import { KeyRound } from 'lucide-react';
import { Button, ErrorAlert } from '@/components/ui';
import { FormField } from '@/components/forms';
import { Input } from '@/components/ui';
import { apiClient, apiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const { user, clearMustChangePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t('auth.changePassword.minLength'));
      return;
    }
    if (newPassword !== confirm) {
      setError(t('auth.changePassword.mismatch'));
      return;
    }
    if (newPassword === 'edunest26') {
      setError(t('auth.changePassword.sameAsDefault'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ message: string; accessToken: string }>('/users/change-password', { newPassword });
      if (!res.success) throw apiError(res.error, t('common.error'));
      if (res.data?.accessToken) {
        localStorage.setItem('access_token', res.data.accessToken);
      }
      clearMustChangePassword();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-warning-muted)] flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h1 className="text-section font-semibold text-text-heading">
                {t('auth.changePassword.title')}
              </h1>
              <p className="text-body text-text-secondary mt-1">
                {t('auth.changePassword.subtitle', { name: user?.firstName })}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label={t('auth.changePassword.newPassword')} htmlFor="new-pwd" required>
              <Input
                id="new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('auth.changePassword.newPasswordPlaceholder')}
                autoFocus
              />
            </FormField>

            <FormField label={t('auth.changePassword.confirmPassword')} htmlFor="confirm-pwd" required>
              <Input
                id="confirm-pwd"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('auth.changePassword.confirmPasswordPlaceholder')}
              />
            </FormField>

            <ErrorAlert message={error} />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.changePassword.submit')}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full text-center text-caption text-text-secondary hover:text-danger transition-colors"
          >
            {t('auth.changePassword.logout')}
          </button>
        </div>
    </AuthShell>
  );
}
