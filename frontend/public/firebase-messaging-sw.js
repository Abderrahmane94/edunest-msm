/* eslint-disable no-undef */
/**
 * The app's service worker: Firebase Cloud Messaging push, plus what makes
 * EduNest an installable app (PWA) that opens without a network.
 * It is the only service worker: a second one at the same scope would replace
 * this registration and break push.
 *
 * Firebase config is passed in as query params by the page during
 * registration (a service worker cannot read Vite's import.meta.env), so no
 * secrets are hardcoded here — these are the public web-app identifiers.
 *
 * Served at the origin root (/firebase-messaging-sw.js) so it controls the
 * whole app scope.
 */

// ─── Offline: the app opens without a connection ───────────────────────────────
//
// - Pages: network first; offline, the last app page (index.html) is served so
//   the app starts and shows the data saved on the device. Without one yet,
//   the offline page.
// - Built files (/assets/*, content-hashed, so never change): cache first.
// - Google Fonts: cache first, so text keeps its fonts offline.
// API calls aren't touched: data offline comes from the app's own cache.

const SHELL_CACHE = 'edunest-shell-v2';
const ASSET_CACHE = 'edunest-assets-v1';
const FONT_CACHE = 'edunest-fonts-v1';
const KEEP = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';
/** Old builds' files are dropped beyond this many cached files. */
const MAX_ASSETS = 40;

/** Caches the app page and the built files it loads. */
async function cacheShell() {
  const response = await fetch(SHELL_URL, { cache: 'no-cache' });
  if (!response.ok) return;
  const html = await response.clone().text();
  await (await caches.open(SHELL_CACHE)).put(SHELL_URL, response);
  const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all(
    assets.map(async (url) => {
      if (!(await cache.match(url))) await cache.add(url);
    }),
  );
}

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  // Keys come back in insertion order: drop the oldest.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/icon-192.png'])),
      // Best effort: the app page is also cached on each visit.
      cacheShell().catch(() => undefined),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('edunest-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // Every route returns the same app page: keep the latest one for offline.
    const isAppPage = new URL(request.url).pathname !== OFFLINE_URL;
    if (isAppPage && response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy));
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(SHELL_URL)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request, cacheName, onStore) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Opaque (cross-origin, no-cors) font CSS responses have status 0.
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    if (onStore) onStore();
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, () => trimAssets()));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
});

// ─── Push (Firebase Cloud Messaging) ───────────────────────────────────────────

const params = new URLSearchParams(self.location.search);
let messaging = null;

// Without Firebase config (e.g. push not set up) the worker still serves the
// offline page.
if (params.get('apiKey')) {
  try {
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
    firebase.initializeApp({
      apiKey: params.get('apiKey'),
      authDomain: params.get('authDomain'),
      projectId: params.get('projectId'),
      messagingSenderId: params.get('messagingSenderId'),
      appId: params.get('appId'),
    });
    messaging = firebase.messaging();
  } catch (err) {
    console.warn('[sw] Firebase messaging unavailable:', err);
  }
}

// Background message handler — show the OS notification.
messaging?.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'EduNest';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

/**
 * Mirrors the routing rules in frontend/src/lib/notification-display.tsx
 * (notificationLink) so an OS-level push click lands on the same screen an
 * in-app notification click would. Keep the two in sync if either changes.
 */
function buildNotificationUrl(data) {
  const role = data.role;
  const base = role === 'parent' ? '/parent' : role === 'teacher' ? '/teacher' : '/admin';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const referenceId = data.referenceId;
  const referenceType = data.referenceType;

  switch (data.type) {
    case 'message_new':
      if (isAdmin) {
        return referenceType === 'staff_conversation'
          ? `${base}/communication?tab=staff${referenceId ? `&conversationId=${referenceId}` : ''}`
          : `${base}/communication?tab=messages`;
      }
      if (role === 'teacher') {
        const tab = referenceType === 'staff_conversation' ? 'staff' : 'parents';
        return `${base}/messages?tab=${tab}${referenceId ? `&conversationId=${referenceId}` : ''}`;
      }
      return `${base}/messages${referenceId ? `?conversationId=${referenceId}` : ''}`;
    case 'absence_alert':
      return `${base}/attendance`;
    case 'invoice_sent':
    case 'payment_received':
    case 'payment_overdue':
      // Teachers have no payments view; these are only ever sent to parents
      // (and, in principle, admins/super_admins).
      return role === 'teacher' ? base : `${base}/payments`;
    case 'announcement':
      if (isAdmin) {
        return referenceId ? `${base}/communication/announcements/${referenceId}` : `${base}/communication`;
      }
      return `${base}/announcements`;
    case 'daily_report':
      return isAdmin ? base : role === 'parent' ? base : `${base}/daily-reports`;
    case 'event_consent':
      if (isAdmin) {
        return referenceId ? `${base}/communication/events/${referenceId}` : `${base}/communication`;
      }
      return `${base}/announcements`;
    default:
      return base;
  }
}

// Focus (or open) the app and navigate it to the notification's target when
// clicked from the OS notification tray.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = buildNotificationUrl(event.notification.data || {});
  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then((c) => c && c.focus());
        }
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
