import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationEvent {
  title?: string;
  body?: string;
}

/**
 * Cross-cutting notifications wiring, mounted once for authenticated users:
 * - Registers the browser for FCM web push (permission + token sync).
 * - Listens for the real-time `notification:new` socket event and shows an
 *   OS notification when the app is open (covers the case where the user is
 *   active in the tab and FCM's background handler doesn't fire).
 *
 * Renders nothing.
 */
export function NotificationsManager() {
  const { isAuthenticated } = useAuth();
  const { socket } = useSocket();

  usePushNotifications();

  // Attach the listener directly to the live socket instance and re-run when
  // that instance changes (i.e. on every reconnect after a token refresh), so
  // the handler is never left bound to a stale, disconnected socket.
  useEffect(() => {
    if (!isAuthenticated || !socket) return;

    const handler = (payload: NotificationEvent | undefined) => {
      if (!payload?.title) return;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.body, icon: '/icon-192.png' });
      }
    };

    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [isAuthenticated, socket]);

  return null;
}
