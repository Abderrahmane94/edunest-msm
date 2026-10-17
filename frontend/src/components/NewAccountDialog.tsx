import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';
import { onNewAccount, type NewAccount } from '@/lib/newAccount';
import { WhatsAppShareButton } from '@/components/WhatsAppShareButton';

/**
 * Shows, once, the temporary password of an account that was just created
 * (to pass on by phone or in person). Mounted once in the office layout.
 */
export function NewAccountDialog() {
  const { t } = useTranslation();
  const [account, setAccount] = React.useState<NewAccount | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(
    () =>
      onNewAccount((next) => {
        setCopied(false);
        setAccount(next);
      }),
    [],
  );

  async function handleCopy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // No clipboard (old browser, no permission): the password stays visible to copy by hand.
    }
  }

  // The password is shown once: dropped as soon as the dialog closes.
  const close = () => setAccount(null);

  return (
    <Dialog open={!!account} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.newAccount.title')}</DialogTitle>
          <DialogDescription>
            {t('users.newAccount.description')} <span dir="ltr" className="font-medium">{account?.login}</span>
          </DialogDescription>
        </DialogHeader>
        {account && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                data-testid="new-account-password"
                className="flex-1 text-center text-xl font-mono font-semibold tracking-wider bg-subtle border border-border rounded-lg px-4 py-3 select-all"
              >
                {account.temporaryPassword}
              </code>
              <Button type="button" variant="secondary" onClick={() => handleCopy(account.temporaryPassword)}>
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copied ? t('users.resetPassword.copied') : t('users.resetPassword.copy')}
              </Button>
            </div>
            <WhatsAppShareButton
              phone={account.phone}
              name={account.firstName}
              login={account.login}
              password={account.temporaryPassword}
              className="w-full"
            />
            <ul className="text-caption text-text-secondary list-disc ps-5 space-y-1">
              <li>{t('users.newAccount.shownOnce')}</li>
              <li>{t('users.newAccount.mustChange')}</li>
              <li>{t('users.newAccount.lost')}</li>
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={close}>{t('users.newAccount.noted')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
