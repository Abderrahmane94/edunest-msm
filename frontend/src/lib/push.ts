/**
 * Firebase Cloud Messaging (web push) client helpers.
 *
 * Responsibilities:
 * - Lazily initialize the Firebase app + messaging (only when configured).
 * - Request browser notification permission.
 * - Register the app's service worker (also used for the installable app)
 *   and obtain an FCM registration token.
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
import { isIos, isStandalone } from '@/lib/install';
import { apiClient } from '@/lib/api-client';

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
 * Registers the app's single service worker (push + offline page, see
 * public/firebase-messaging-sw.js). Called at startup so the app is
 * installable, and again before asking for a push token — always with the
 * same URL, so it's one registration either way.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
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
  try {
    return await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams.toString()}`);
  } catch (err) {
    console.warn('[sw] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Where notifications stand on this device:
 * - 'unconfigured': the app was built without Firebase;
 * - 'install': an iPhone in a Safari tab, which only gets them once Kiddoo
 *   is on the home screen and opened from there;
 * - 'unsupported': this browser can't get them;
 * - 'ask': not asked yet; 'denied': refused (only the browser's settings can
 *   undo it); 'on': allowed.
 */
export type PushState = 'unconfigured' | 'install' | 'unsupported' | 'ask' | 'denied' | 'on';

export async function pushState(): Promise<PushState> {
  if (!isPushConfigured()) return 'unconfigured';
  if (isIos() && !isStandalone()) return 'install';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (!(await isSupported().catch(() => false))) return 'unsupported';
  if (Notification.permission === 'granted') return 'on';
  if (Notification.permission === 'denied') return 'denied';
  return 'ask';
}

/**
 * Returns this device's FCM registration token, or null if unavailable or
 * not allowed. `ask`: may open the browser's permission question — only
 * from a tap (iPhone refuses it otherwise, and other browsers hide or block
 * a question nobody asked for). Safe to call repeatedly: getToken reuses the
 * existing token.
 */
export async function requestPushToken(ask = false): Promise<string | null> {
  const m = await getMessagingInstance();
  if (!m) return null;

  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const permission =
      Notification.permission === 'default' && ask
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== 'granted') return null;

    const registration = await registerServiceWorker();
    if (!registration) return null;

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

/**
 * Shows a system notification while the app is open. Through the service
 * worker, as Android requires (`new Notification()` throws there); the plain
 * constructor only where no worker is ready. Never throws: a notification
 * that can't show is just skipped, the in-app bell has it anyway.
 */
export async function showSystemNotification(title: string, body?: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body, icon: '/icon-192.png' };
  try {
    const registration =
      'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch (err) {
    console.warn('[notifications] Could not show a system notification:', err);
  }
}

/** This device's token once registered, kept so signing out can unregister it. */
const REGISTERED_TOKEN_KEY = 'fcm_token';

export function registeredToken(): string | null {
  try {
    return localStorage.getItem(REGISTERED_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** This device gets the signed-in person's notifications. */
export async function registerDevice(token: string): Promise<boolean> {
  const res = await apiClient.post('/notifications/devices', { token });
  if (!res.success) return false;
  try {
    localStorage.setItem(REGISTERED_TOKEN_KEY, token);
  } catch {
    // Without storage the device still gets them; signing out just can't unregister it.
  }
  return true;
}

/**
 * Signing out: this device stops getting this person's notifications (a
 * phone shared by two parents, a computer at the office). Never throws.
 */
export async function forgetThisDevice(): Promise<void> {
  const token = registeredToken();
  if (!token) return;
  try {
    await apiClient.post('/notifications/devices/forget', { token });
  } catch {
    // Offline: the next account signing in here takes the device over anyway.
  }
}
