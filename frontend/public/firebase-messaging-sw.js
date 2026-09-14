/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker.
 *
 * Handles push notifications delivered while the app tab is closed or in the
 * background. Firebase config is passed in as query params by the page during
 * registration (a service worker cannot read Vite's import.meta.env), so no
 * secrets are hardcoded here — these are the public web-app identifiers.
 *
 * Served at the origin root (/firebase-messaging-sw.js) so it controls the
 * whole app scope.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

// Background message handler — show the OS notification.
messaging.onBackgroundMessage((payload) => {
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
      return `${base}/messages`;
    case 'absence_alert':
      return `${base}/attendance`;
    case 'invoice_sent':
    case 'payment_received':
    case 'payment_overdue':
      return role === 'parent' ? `${base}/invoices` : `${base}/payments`;
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
