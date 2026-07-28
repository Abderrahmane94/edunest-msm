import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui';
import { FormField } from '@/components/forms';
import { Input } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
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
      if (!res.success) throw new Error(res.error?.message ?? t('common.error'));
      if (res.data?.accessToken) {
        localStorage.setItem('access_token', res.data.accessToken);
      }
      clearMustChangePassword();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <span className="text-[var(--color-text-inverse)] text-label font-semibold">E</span>
          </div>
          <span className="text-section font-semibold text-text-heading">EduNest</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-level-2 space-y-6">
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

            {error && (
              <p className="text-body text-danger">{error}</p>
            )}

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
      </div>
    </div>
  );
}
