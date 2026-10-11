import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, KeyRound, Mail } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
} from '@/components/ui';
import { useResetUserPassword, useSendResetLink } from '@/hooks/useUsers';

type Outcome = { kind: 'password'; password: string } | { kind: 'email'; email: string };

/**
 * Lets an admin give a user a new temporary password (shown once, to pass on
 * by phone or in person) or email them a reset link instead.
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; first_name: string; last_name: string; email: string };
}) {
  const { t } = useTranslation();
  const resetPassword = useResetUserPassword();
  const sendLink = useSendResetLink();
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const name = `${user.first_name} ${user.last_name}`;
  const busy = resetPassword.isPending || sendLink.isPending;

  React.useEffect(() => {
    if (!open) return;
    setOutcome(null);
    setError(null);
    setCopied(false);
  }, [open]);

  function close(isOpen: boolean) {
    if (busy) return;
    // The password is shown once: drop it as soon as the dialog closes.
    if (!isOpen) setOutcome(null);
    onOpenChange(isOpen);
  }

  async function handleGenerate() {
    setError(null);
    try {
      const password = await resetPassword.mutateAsync(user.id);
      setOutcome({ kind: 'password', password });
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function handleSendLink() {
    setError(null);
    try {
      const email = await sendLink.mutateAsync(user.id);
      setOutcome({ kind: 'email', email });
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function handleCopy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (old browser, no permission): the password stays visible to copy by hand.
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.resetPassword.title')}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>

        {!outcome && (
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 space-y-2">
              <p className="text-body font-medium text-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                {t('users.resetPassword.temporary.title')}
              </p>
              <p className="text-caption text-text-secondary">{t('users.resetPassword.temporary.description', { name })}</p>
              <Button type="button" onClick={handleGenerate} disabled={busy}>
                {resetPassword.isPending ? t('common.loading') : t('users.resetPassword.temporary.action')}
              </Button>
            </div>

            <div className="border border-border rounded-lg p-4 space-y-2">
              <p className="text-body font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                {t('users.resetPassword.email.title')}
              </p>
              <p className="text-caption text-text-secondary">
                {t('users.resetPassword.email.description')} <span dir="ltr" className="font-medium">{user.email}</span>
              </p>
              <Button type="button" variant="secondary" onClick={handleSendLink} disabled={busy}>
                {sendLink.isPending ? t('common.loading') : t('users.resetPassword.email.action')}
              </Button>
            </div>

            <ErrorAlert message={error} />
          </div>
        )}

        {outcome?.kind === 'password' && (
          <div className="space-y-4">
            <p className="text-body text-foreground">{t('users.resetPassword.temporary.done', { name })}</p>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                data-testid="temporary-password"
                className="flex-1 text-center text-xl font-mono font-semibold tracking-wider bg-subtle border border-border rounded-lg px-4 py-3 select-all"
              >
                {outcome.password}
              </code>
              <Button type="button" variant="secondary" onClick={() => handleCopy(outcome.password)}>
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copied ? t('users.resetPassword.copied') : t('users.resetPassword.copy')}
              </Button>
            </div>
            <ul className="text-caption text-text-secondary list-disc ps-5 space-y-1">
              <li>{t('users.resetPassword.temporary.shownOnce')}</li>
              <li>{t('users.resetPassword.temporary.mustChange', { name })}</li>
              <li>{t('users.resetPassword.temporary.sessionsClosed')}</li>
            </ul>
          </div>
        )}

        {outcome?.kind === 'email' && (
          <p className="text-body text-foreground">
            {t('users.resetPassword.email.done')} <span dir="ltr" className="font-medium">{outcome.email}</span>.
            {' '}{t('users.resetPassword.email.validity')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant={outcome ? 'primary' : 'secondary'} onClick={() => close(false)} disabled={busy}>
            {outcome ? t('common.close') : t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
