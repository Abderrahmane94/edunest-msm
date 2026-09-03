import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { isPushConfigured, requestPushToken, onForegroundMessage } from '@/lib/push';

const REGISTERED_TOKEN_KEY = 'fcm_token';

/**
 * Registers the browser for push notifications once the user is authenticated:
 * requests permission, obtains an FCM token, and syncs it to the backend via
 * PATCH /api/users/:id/fcm-token. Also surfaces foreground messages as OS
 * notifications while the app tab is focused.
 *
 * Fails soft everywhere: unconfigured Firebase, unsupported browser, or a
 * denied permission simply results in no push registration — the rest of the
 * app (including in-app socket notifications) is unaffected.
 */
export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || !isPushConfigured()) return;
    // Only attempt registration once per session to avoid re-prompting.
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let cancelled = false;

    (async () => {
      const token = await requestPushToken();
      if (cancelled || !token) return;

      // Skip the network call if the backend already has this exact token.
      if (localStorage.getItem(REGISTERED_TOKEN_KEY) === token) return;

      const res = await apiClient.patch(`/users/${user.id}/fcm-token`, { fcmToken: token });
      if (res.success) {
        localStorage.setItem(REGISTERED_TOKEN_KEY, token);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  // Foreground messages: the SW only fires for background/closed tabs, so show
  // a notification ourselves when a push arrives while the app is focused.
  useEffect(() => {
    if (!isAuthenticated || !isPushConfigured()) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    onForegroundMessage((payload) => {
      const title = payload.notification?.title;
      const body = payload.notification?.body;
      if (!title) return;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated]);
}
