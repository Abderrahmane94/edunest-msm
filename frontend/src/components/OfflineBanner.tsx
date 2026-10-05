import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfflineQueue } from '@/lib/offlineQueue';

function subscribe(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** How long "connection restored" stays up once back online. */
const RESTORED_MS = 3000;

/**
 * Banner shown while the device has no connection, on every page, and briefly
 * "connection restored" once it's back. Data requests wait while offline and
 * resume on their own when the connection returns (react-query's default
 * online network mode), so nothing needs reloading.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = React.useSyncExternalStore(subscribe, () => navigator.onLine);
  const { actions } = useOfflineQueue();
  const waiting = actions.filter((a) => !a.error).length;
  const [restored, setRestored] = React.useState(false);
  const wasOffline = React.useRef(!online);

  React.useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setRestored(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setRestored(true);
    const timer = setTimeout(() => setRestored(false), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [online]);

  if (online && !restored) return null;

  return (
    // Floats above the mobile bottom tab bar; clicks pass through around it.
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+0.75rem)] lg:bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto flex items-center gap-2 max-w-md rounded-full px-4 py-2 shadow-level-4 text-caption font-medium animate-fade-in',
          online ? 'bg-success text-white' : 'bg-[#1F2937] text-white',
        )}
      >
        {online ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
        <span>
          {online ? t('offline.restored') : t('offline.banner')}
          {!online && waiting > 0 && (
            <span className="block text-micro opacity-80">{t('offline.pending', { count: waiting })}</span>
          )}
        </span>
      </div>
    </div>
  );
}
