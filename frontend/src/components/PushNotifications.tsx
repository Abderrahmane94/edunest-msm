import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, BellRing, Check, Send, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { IosInstallDialog } from '@/components/InstallAppButton';
import { usePushSetup, type PushTestResult } from '@/hooks/usePushNotifications';
import { errorMessage } from '@/lib/errorMessage';
import { cn } from '@/lib/utils';

/** "Later" on the banner: it comes back after this long. */
const LATER_DAYS = 14;
const LATER_KEY = 'push_banner_later';

function laterUntil(): number {
  try {
    return Number(localStorage.getItem(LATER_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * At the top of the pages, until notifications are on for this device:
 * the question is asked when the person taps « Activer » (a browser only
 * shows it then — an iPhone never otherwise). On an iPhone in Safari, how to
 * put Kiddoo on the home screen first, without which nothing arrives there.
 */
export function PushNotificationsBanner({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { state, enabling, enable } = usePushSetup();
  const [hidden, setHidden] = React.useState(() => laterUntil() > Date.now());
  const [iosHelp, setIosHelp] = React.useState(false);

  if (hidden || (state !== 'ask' && state !== 'install')) return null;

  function later() {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now() + LATER_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // Hidden for this visit only.
    }
    setHidden(true);
  }

  return (
    <div
      role="note"
      data-testid="push-banner"
      className={cn('mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2', className)}
    >
      <BellRing className="h-5 w-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 basis-48 text-caption text-foreground">
        <span className="font-semibold">{t('pushSetup.banner.title')}</span>{' '}
        {t(state === 'install' ? 'pushSetup.banner.install' : 'pushSetup.banner.text')}
      </p>
      <div className="flex items-center gap-1 ms-auto">
        {state === 'install' ? (
          <Button size="sm" onClick={() => setIosHelp(true)}>
            <Smartphone className="h-4 w-4" />
            {t('pushSetup.howTo')}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void enable()} disabled={enabling}>
            <BellRing className="h-4 w-4" />
            {t('pushSetup.enable')}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={later} aria-label={t('pushSetup.banner.later')} title={t('pushSetup.banner.later')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <IosInstallDialog open={iosHelp} onOpenChange={setIosHelp} />
    </div>
  );
}

/** In the profile: where notifications stand on this device, what to do, and a test. */
export function PushNotificationsCard() {
  const { t } = useTranslation();
  const { state, registered, enabling, enable, test } = usePushSetup();
  const [iosHelp, setIosHelp] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  if (state === null) return null;

  async function sendTest() {
    setTesting(true);
    setResult(null);
    try {
      setResult(testOutcome(await test(), t));
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err, t) });
    } finally {
      setTesting(false);
    }
  }

  const on = state === 'on' && registered;
  return (
    <section id="notifications" className="bg-card border border-border rounded-lg p-6 space-y-3 scroll-mt-20" data-testid="push-card">
      <div className="flex items-start gap-3">
        {on ? <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />}
        <div className="min-w-0">
          <h2 className="text-subsection font-semibold text-text-heading">{t('pushSetup.card.title')}</h2>
          <p className="text-caption text-text-secondary" data-testid="push-state">
            {t(on ? 'pushSetup.card.on' : state === 'on' ? 'pushSetup.card.notRegistered' : `pushSetup.card.${state}`)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state === 'ask' && (
          <Button size="sm" onClick={() => void enable()} disabled={enabling}>
            <BellRing className="h-4 w-4" />
            {t('pushSetup.enable')}
          </Button>
        )}
        {state === 'on' && !registered && (
          <Button size="sm" onClick={() => void enable()} disabled={enabling}>
            {t('pushSetup.retry')}
          </Button>
        )}
        {state === 'install' && (
          <Button size="sm" onClick={() => setIosHelp(true)}>
            <Smartphone className="h-4 w-4" />
            {t('pushSetup.howTo')}
          </Button>
        )}
        {on && (
          <Button size="sm" variant="secondary" onClick={() => void sendTest()} disabled={testing}>
            <Send className="h-4 w-4" />
            {testing ? t('pushSetup.testing') : t('pushSetup.test')}
          </Button>
        )}
      </div>
      {result && (
        <p role="status" className={cn('flex items-start gap-1.5 text-caption', result.ok ? 'text-foreground' : 'text-danger')}>
          {result.ok && <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
          {result.text}
        </p>
      )}
      <IosInstallDialog open={iosHelp} onOpenChange={setIosHelp} />
    </section>
  );
}

function testOutcome(r: PushTestResult, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!r.configured) return { ok: false, text: t('pushSetup.result.notConfigured') };
  if (r.devices === 0) return { ok: false, text: t('pushSetup.result.noDevice') };
  if (r.sent === 0) return { ok: false, text: t('pushSetup.result.failed') };
  return { ok: true, text: t('pushSetup.result.sent', { count: r.sent }) };
}
