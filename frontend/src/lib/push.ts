/**
 * Firebase Cloud Messaging (web push) client helpers.
 *
 * Responsibilities:
 * - Lazily initialize the Firebase app + messaging (only when configured).
 * - Request browser notification permission.
 * - Register the app's service worker and obtain an FCM registration token.
 * - Expose a foreground-message subscriber for in-app handling.
 *
 * All functions fail soft: if Firebase env vars are missing, the browser
 * doesn't support push, or the user denies permission, they resolve to
 * null/no-op rather than throwing, so callers never break the app.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/** True when all required Firebase web config values are present. */
export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY,
  );
}

/**
 * Returns a Messaging instance, or null if push is not configured or the
 * current browser does not support the FCM web SDK (e.g. plain iOS Safari tab).
 */
async function getMessagingInstance(): Promise<Messaging | null> {
  if (!isPushConfigured()) return null;
  if (messaging) return messaging;

  try {
    if (!(await isSupported())) return null;
    app = app ?? initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.warn('[push] Failed to initialize Firebase messaging:', err);
    return null;
  }
}

/**
 * Requests notification permission and returns an FCM registration token,
 * or null if unavailable/denied. Safe to call repeatedly — the browser only
 * prompts once, and getToken reuses the existing token afterward.
 */
export async function requestPushToken(): Promise<string | null> {
  const m = await getMessagingInstance();
  if (!m) return null;

  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== 'granted') return null;

    // The SW must live at the origin root so it can control the whole app.
    // A service worker file can't read import.meta.env, so pass the Firebase
    // config it needs (for background messages) as query params.
    const swParams = new URLSearchParams({
      apiKey: firebaseConfig.apiKey ?? '',
      authDomain: firebaseConfig.authDomain ?? '',
      projectId: firebaseConfig.projectId ?? '',
      messagingSenderId: firebaseConfig.messagingSenderId ?? '',
      appId: firebaseConfig.appId ?? '',
    });
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${swParams.toString()}`,
    );

    const token = await getToken(m, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (err) {
    console.warn('[push] Failed to obtain FCM token:', err);
    return null;
  }
}

/**
 * Subscribes to messages received while the app is in the foreground.
 * Returns an unsubscribe function (no-op if push isn't available).
 */
export async function onForegroundMessage(
  handler: (payload: MessagePayload) => void,
): Promise<() => void> {
  const m = await getMessagingInstance();
  if (!m) return () => undefined;
  return onMessage(m, handler);
}
