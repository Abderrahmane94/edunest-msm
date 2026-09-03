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

// Focus or open the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
