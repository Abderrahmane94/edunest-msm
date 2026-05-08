import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface InvitationInfo {
  email: string;
  role: string;
  schoolName?: string;
}

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens } = useAuth();

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

  useEffect(() => {
    async function verifyInvitation() {
      if (!token) {
        setError('No invitation token provided. Please use the link from your invitation email.');
        setIsLoadingInvitation(false);
        return;
      }

      try {
        const response = await apiClient.get<InvitationInfo>(
          `/auth/invitation/${token}`,
          { skipAuth: true } as RequestInit,
        );

        if (response.success && response.data) {
          setInvitation(response.data);
        } else {
          setError(response.error?.message || 'Invalid or expired invitation link.');
        }
      } catch {
        setError('Unable to verify invitation. Please try again later.');
      } finally {
        setIsLoadingInvitation(false);
      }
    }

    verifyInvitation();
  }, [token]);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        '/auth/register',
        { token, firstName, lastName, password },
        { skipAuth: true } as RequestInit,
      );

      if (response.success && response.data) {
        setTokens(response.data.accessToken, response.data.refreshToken);
        navigate('/');
      } else {
        setError(response.error?.message || 'Registration failed. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <p className="text-body text-text-secondary">Verifying invitation…</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            Invalid Invitation
          </h1>
          <p className="text-body text-text-secondary mb-4">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6">
        <h1 className="text-display font-bold text-text-heading mb-2">
          Create Account
        </h1>
        <p className="text-body text-text-secondary mb-6">
          You've been invited as <span className="font-medium text-foreground capitalize">{invitation.role.replace('_', ' ')}</span>
          {invitation.schoolName && <> at <span className="font-medium text-foreground">{invitation.schoolName}</span></>}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--color-danger-muted)] border-s-[3px] border-danger">
            <p className="text-body text-danger">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            name="email"
            type="email"
            value={invitation.email}
            disabled
            helperText="Set by your invitation"
          />

          <Input
            label="First Name"
            name="firstName"
            type="text"
            placeholder="Enter your first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            error={fieldErrors.firstName}
            required
            autoComplete="given-name"
          />

          <Input
            label="Last Name"
            name="lastName"
            type="text"
            placeholder="Enter your last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            error={fieldErrors.lastName}
            required
            autoComplete="family-name"
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
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
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
