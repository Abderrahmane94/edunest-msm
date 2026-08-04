import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface InvitationInfo {
  email: string;
  role: string;
  schoolName?: string;
}

export function RegisterPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function verifyInvitation() {
      if (!token) {
        setError(t('auth.register.noToken'));
        setIsLoadingInvitation(false);
        return;
      }

      try {
        const response = await apiClient.get<InvitationInfo>(
          `/users/invitation/${token}`,
          { skipAuth: true } as RequestInit,
        );

        if (response.success && response.data) {
          setInvitation(response.data);
        } else {
          setError(response.error?.message || t('auth.register.invalidOrExpired'));
        }
      } catch {
        setError(t('auth.register.verifyFailed'));
      } finally {
        setIsLoadingInvitation(false);
      }
    }

    verifyInvitation();
  }, [token, t]);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = t('auth.register.firstNameRequired');
    if (!lastName.trim()) errors.lastName = t('auth.register.lastNameRequired');
    if (password.length < 8) errors.password = t('auth.register.passwordMinLength');
    if (password !== confirmPassword) errors.confirmPassword = t('auth.register.passwordMismatch');

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
        '/users/register',
        { token, firstName, lastName, password },
        { skipAuth: true } as RequestInit,
      );

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error?.message || t('auth.register.genericError'));
      }
    } catch {
      setError(t('auth.register.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <p className="text-body text-text-secondary">{t('auth.register.verifying')}</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            {t('auth.register.invalidTitle')}
          </h1>
          <p className="text-body text-text-secondary mb-4">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/login')}>
            {t('auth.register.goToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            {t('auth.register.successTitle')}
          </h1>
          <p className="text-body text-text-secondary mb-6">
            {t('auth.register.successMessage')}
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            {t('auth.register.goToLoginButton')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6">
        <h1 className="text-display font-bold text-text-heading mb-2">
          {t('auth.register.title')}
        </h1>
        <p className="text-body text-text-secondary mb-6">
          {t('auth.register.invitedAs')} <span className="font-medium text-foreground capitalize">{invitation.role.replace('_', ' ')}</span>
          {invitation.schoolName && <> {t('auth.register.at')} <span className="font-medium text-foreground">{invitation.schoolName}</span></>}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--color-danger-muted)] border-s-[3px] border-danger">
            <p className="text-body text-danger">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('auth.email')}
            name="email"
            type="email"
            value={invitation.email}
            disabled
            helperText={t('auth.register.emailSetByInvitation')}
          />

          <Input
            label={t('auth.register.firstName')}
            name="firstName"
            type="text"
            placeholder={t('auth.register.firstNamePlaceholder')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            error={fieldErrors.firstName}
            required
            autoComplete="given-name"
          />

          <Input
            label={t('auth.register.lastName')}
            name="lastName"
            type="text"
            placeholder={t('auth.register.lastNamePlaceholder')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            error={fieldErrors.lastName}
            required
            autoComplete="family-name"
          />

          <Input
            label={t('auth.register.password')}
            name="password"
            type="password"
            placeholder={t('auth.register.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
            autoComplete="new-password"
          />

          <Input
            label={t('auth.register.confirmPassword')}
            name="confirmPassword"
            type="password"
            placeholder={t('auth.register.confirmPasswordPlaceholder')}
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
            {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
