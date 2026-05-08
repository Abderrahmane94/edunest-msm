import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ResetPasswordRequestPage() {
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
        '/auth/reset-password',
        { email },
        { skipAuth: true } as RequestInit,
      );

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error?.message || 'Unable to send reset email. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-display font-bold text-text-heading mb-4">
            Check Your Email
          </h1>
          <p className="text-body text-text-secondary mb-6">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent a password reset link.
          </p>
          <Link to="/login">
            <Button variant="secondary">Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-[400px] bg-card border border-border rounded-lg p-6">
        <h1 className="text-display font-bold text-text-heading mb-2">
          Reset Password
        </h1>
        <p className="text-body text-text-secondary mb-6">
          Enter your email address and we'll send you a link to reset your password.
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
            placeholder="you@example.com"
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
            {isSubmitting ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="text-body text-[var(--color-accent)] hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
