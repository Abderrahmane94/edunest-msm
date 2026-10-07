import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnline } from '@/lib/online';
import { useOfflineQueue } from '@/lib/offlineQueue';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

/**
 * Logout that asks first when offline: signing in again needs the network,
 * so logging out by mistake without one would lock the user out until it's
 * back. Render `dialog` next to the button that calls `requestLogout`.
 */
export function useLogoutWithConfirm(): { requestLogout: () => void; dialog: React.ReactNode } {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const [confirming, setConfirming] = React.useState(false);

  const doLogout = React.useCallback(async () => {
    setConfirming(false);
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const requestLogout = React.useCallback(() => {
    if (navigator.onLine) void doLogout();
    else setConfirming(true);
  }, [doLogout]);

  // Back online while the question is open: nothing to warn about any more.
  const open = confirming && !online;

  return {
    requestLogout,
    dialog: <OfflineLogoutDialog open={open} onCancel={() => setConfirming(false)} onConfirm={doLogout} />,
  };
}

function OfflineLogoutDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const { actions } = useOfflineQueue();
  const waiting = actions.filter((a) => !a.error).length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-warning shrink-0" />
              {t('auth.offlineLogout.title')}
            </span>
          </DialogTitle>
          <DialogDescription>{t('auth.offlineLogout.message')}</DialogDescription>
        </DialogHeader>
        {waiting > 0 && (
          <p className="text-body text-text-secondary">{t('auth.offlineLogout.pending', { count: waiting })}</p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            {t('auth.offlineLogout.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('auth.offlineLogout.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
