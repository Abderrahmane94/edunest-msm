import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfflineQueue } from '@/lib/offlineQueue';
import { useOnline } from '@/lib/online';

/** How long "connection restored" stays up once back online. */
const RESTORED_MS = 3000;

/**
 * Offline badge for the page header, next to the notification bell: it takes
 * free header space instead of floating over the page, so it never hides a
 * button or the message input. Tapping it explains what still works; once
 * back online it briefly says "connection restored". Data requests wait while
 * offline and resume on their own (react-query's online network mode).
 */
export function OfflineStatus() {
  const { t } = useTranslation();
  const online = useOnline();
  const { actions } = useOfflineQueue();
  const waiting = actions.filter((a) => !a.error).length;
  const [restored, setRestored] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const wasOffline = React.useRef(!online);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setRestored(false);
      return;
    }
    setOpen(false);
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setRestored(true);
    const timer = setTimeout(() => setRestored(false), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [online]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (online && !restored) return null;

  if (online) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-success text-white text-caption font-medium animate-fade-in"
      >
        <Wifi className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">{t('offline.restored')}</span>
      </span>
    );
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        role="status"
        aria-live="polite"
        aria-expanded={open}
        aria-label={t('offline.badge')}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-[#1F2937] text-white text-caption font-medium animate-fade-in"
      >
        <WifiOff className="w-4 h-4 shrink-0" />
        {/* On the narrowest phones the icon alone keeps the header on one line. */}
        <span className="hidden min-[380px]:inline">{t('offline.badge')}</span>
        {waiting > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-[#1F2937] text-[10px] font-semibold flex items-center justify-center">
            {waiting > 99 ? '99+' : waiting}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute end-0 mt-2 w-[300px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl p-4 z-50',
            'shadow-[0_10px_30px_rgba(15,23,42,0.12),0_4px_8px_rgba(15,23,42,0.06)]',
          )}
        >
          <p className="text-body text-text-primary">{t('offline.banner')}</p>
          <p className="text-caption text-text-secondary mt-2">{t('offline.details')}</p>
          {waiting > 0 && (
            <p className="text-caption font-medium text-text-primary mt-2">{t('offline.pending', { count: waiting })}</p>
          )}
        </div>
      )}
    </div>
  );
}
