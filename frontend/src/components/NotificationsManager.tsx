import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { showSystemNotification } from '@/lib/push';

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
  const queryClient = useQueryClient();

  usePushNotifications();

  // Attach the listener directly to the live socket instance and re-run when
  // that instance changes (i.e. on every reconnect after a token refresh), so
  // the handler is never left bound to a stale, disconnected socket.
  useEffect(() => {
    if (!isAuthenticated || !socket) return;

    const handler = (payload: NotificationEvent | undefined) => {
      // Refresh the in-app notification center (bell badge + list) in real time.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      if (!payload?.title) return;
      void showSystemNotification(payload.title, payload.body);
    };

    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [isAuthenticated, socket, queryClient]);

  return null;
}
