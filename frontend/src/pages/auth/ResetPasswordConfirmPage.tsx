import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ResetPasswordConfirmPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (password.length < 8) errors.password = t('auth.resetPasswordConfirm.passwordMinLength');
    if (password !== confirmPassword) errors.confirmPassword = t('auth.resetPasswordConfirm.passwordMismatch');

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await apiClient.post(
        '/auth/password-reset/confirm',
        { token, newPassword: password },
        { skipAuth: true } as RequestInit,
      );

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error?.message || t('auth.resetPasswordConfirm.genericError'));
      }
    } catch {
      setError(t('auth.resetPasswordConfirm.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            {t('auth.resetPasswordConfirm.invalidLinkTitle')}
          </h1>
          <p className="text-body text-text-secondary mb-4">
            {t('auth.resetPasswordConfirm.invalidLinkMessage')}
          </p>
          <Link to="/reset-password">
            <Button variant="secondary">{t('auth.resetPasswordConfirm.requestNewLink')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            {t('auth.resetPasswordConfirm.successTitle')}
          </h1>
          <p className="text-body text-text-secondary mb-6">
            {t('auth.resetPasswordConfirm.successMessage')}
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            {t('auth.resetPasswordConfirm.goToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6">
        <h1 className="text-display font-bold text-text-heading mb-2">
          {t('auth.resetPasswordConfirm.title')}
        </h1>
        <p className="text-body text-text-secondary mb-6">
          {t('auth.resetPasswordConfirm.subtitle')}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--color-danger-muted)] border-s-[3px] border-danger">
            <p className="text-body text-danger">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('auth.resetPasswordConfirm.newPassword')}
            name="password"
            type="password"
            placeholder={t('auth.resetPasswordConfirm.newPasswordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
            autoComplete="new-password"
          />

          <Input
            label={t('auth.resetPasswordConfirm.confirmNewPassword')}
            name="confirmPassword"
            type="password"
            placeholder={t('auth.resetPasswordConfirm.confirmNewPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            required
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.resetPasswordConfirm.submitting') : t('auth.resetPasswordConfirm.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
