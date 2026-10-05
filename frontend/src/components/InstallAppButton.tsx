import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui';
import { useInstallMode, promptInstall } from '@/lib/install';

/**
 * "Install the app" — only shown where the app can be installed and isn't yet.
 * `menu`: a full-width row (sidebar / account menu); `icon`: a header icon.
 */
export function InstallAppButton({ variant = 'menu' }: { variant?: 'menu' | 'icon' }) {
  const { t } = useTranslation();
  const mode = useInstallMode();
  const [iosHelpOpen, setIosHelpOpen] = React.useState(false);

  if (!mode) return null;

  function handleClick() {
    if (mode === 'prompt') void promptInstall();
    else setIosHelpOpen(true);
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition-colors duration-150"
          aria-label={t('install.button')}
          title={t('install.button')}
        >
          <Download className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-body font-medium text-primary hover:bg-subtle transition-all duration-150"
        >
          <Download className="w-5 h-5 shrink-0" />
          <span>{t('install.button')}</span>
        </button>
      )}

      <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('install.iosTitle')}</DialogTitle>
            <DialogDescription>{t('install.iosIntro')}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            <Step n={1} icon={<Share className="w-4 h-4" />} text={t('install.iosStep1')} />
            <Step n={2} icon={<SquarePlus className="w-4 h-4" />} text={t('install.iosStep2')} />
            <Step n={3} text={t('install.iosStep3')} />
          </ol>
          <p className="text-caption text-text-secondary mt-4">{t('install.iosSafariOnly')}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ n, icon, text }: { n: number; icon?: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-accent-subtle)] text-primary text-caption font-semibold flex items-center justify-center">
        {n}
      </span>
      <span className="text-body text-foreground flex items-center gap-1.5 flex-wrap">
        {text}
        {icon && <span className="text-primary">{icon}</span>}
      </span>
    </li>
  );
}
