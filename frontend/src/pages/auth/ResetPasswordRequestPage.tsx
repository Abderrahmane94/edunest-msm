import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        setError(response.error?.message || t('auth.resetPasswordRequest.genericError'));
      }
    } catch {
      setError(t('auth.resetPasswordRequest.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6">
        <h1 className="text-display font-bold text-text-heading mb-2">
          {t('auth.resetPasswordRequest.title')}
        </h1>
        <p className="text-body text-text-secondary mb-6">
          {t('auth.resetPasswordRequest.subtitle')}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--color-danger-muted)] border-s-[3px] border-danger">
            <p className="text-body text-danger">{error}</p>
          </div>
        )}

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
    </div>
  );
}
