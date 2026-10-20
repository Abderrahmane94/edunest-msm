import * as React from 'react';
import { useEffect, useRef } from 'react';
import { apiClient, apiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushConfigured,
  requestPushToken,
  onForegroundMessage,
  showSystemNotification,
  pushState,
  registerDevice,
  registeredToken,
  type PushState,
} from '@/lib/push';

/** Said to every place showing the state when it changes (the banner and the profile). */
const CHANGED = 'push:changed';

/**
 * Keeps this device registered once the user is signed in — when
 * notifications are already allowed: the question itself is only ever asked
 * from a tap (see usePushSetup). Registered on each start, which also moves
 * a shared device to the account now signed in. Also shows foreground
 * messages as OS notifications while the app is open.
 *
 * Fails soft everywhere: unconfigured Firebase, unsupported browser, or a
 * denied permission simply results in no push registration — the rest of the
 * app (including in-app socket notifications) is unaffected.
 */
export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth();
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user || !isPushConfigured()) return;
    // Once per session and account.
    if (attemptedRef.current === user.id) return;
    attemptedRef.current = user.id;

    let cancelled = false;
    (async () => {
      const token = await requestPushToken(false);
      if (cancelled || !token) return;
      if (await registerDevice(token)) window.dispatchEvent(new Event(CHANGED));
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
      const data = payload.data ?? {};
      const title = data.title ?? payload.notification?.title;
      if (!title) return;
      void showSystemNotification(title, data.body ?? payload.notification?.body, {
        icon: data.icon,
        tag: data.tag,
        lang: data.lang,
        data,
      });
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

export interface PushTestResult {
  devices: number;
  sent: number;
  configured: boolean;
}

/**
 * Turning notifications on, from a tap: where they stand on this device
 * (null while it is being found out), whether this device is registered,
 * and the actions.
 */
export function usePushSetup() {
  const [state, setState] = React.useState<PushState | null>(null);
  const [registered, setRegistered] = React.useState(() => registeredToken() !== null);
  const [enabling, setEnabling] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const refresh = () => {
      void pushState().then((s) => alive && setState(s));
      setRegistered(registeredToken() !== null);
    };
    refresh();
    window.addEventListener(CHANGED, refresh);
    // Back from the phone's settings, where notifications may have been allowed.
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  /** Asks the browser, then registers this device. True when it is done. */
  const enable = React.useCallback(async (): Promise<boolean> => {
    setEnabling(true);
    try {
      const token = await requestPushToken(true);
      const ok = token !== null && (await registerDevice(token));
      window.dispatchEvent(new Event(CHANGED));
      return ok;
    } finally {
      setEnabling(false);
    }
  }, []);

  /** A test notification to each of this person's devices. */
  const test = React.useCallback(async (): Promise<PushTestResult> => {
    const res = await apiClient.post<PushTestResult>('/notifications/devices/test');
    if (!res.success || !res.data) throw apiError(res.error, 'Failed to send the test notification');
    return res.data;
  }, []);

  return { state, registered, enabling, enable, test };
}
