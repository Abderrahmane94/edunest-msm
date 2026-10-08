import { errorMessage } from '@/lib/errorMessage';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '@/components/layout/AuthShell';
import { apiClient, apiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorAlert } from '@/components/ui';

export function ResetPasswordRequestPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiClient.post(
        '/auth/password-reset/request',
        { email },
        { skipAuth: true } as RequestInit,
      );

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error ? errorMessage(apiError(response.error, ''), t) : t('auth.resetPasswordRequest.genericError'));
      }
    } catch {
      setError(t('auth.resetPasswordRequest.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <AuthShell>
        <div className="text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            {t('auth.resetPasswordRequest.checkEmailTitle')}
          </h1>
          <p className="text-body text-text-secondary mb-6">
            {t('auth.resetPasswordRequest.checkEmailMessage', { email })}
          </p>
          <Link to="/login">
            <Button variant="secondary">{t('auth.resetPasswordRequest.backToLogin')}</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-display font-bold text-text-heading mb-2">
          {t('auth.resetPasswordRequest.title')}
        </h1>
        <p className="text-body text-text-secondary mb-6">
          {t('auth.resetPasswordRequest.subtitle')}
        </p>

        <ErrorAlert message={error} className="mb-4" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('auth.resetPasswordRequest.email')}
            name="email"
            type="email"
            placeholder={t('auth.resetPasswordRequest.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.resetPasswordRequest.submitting') : t('auth.resetPasswordRequest.submit')}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="text-body text-[var(--color-accent)] hover:underline"
          >
            {t('auth.resetPasswordRequest.backToLogin')}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
