import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';
import { registerServiceWorker } from './lib/push';
// Listens for the browser's install prompt from startup.
import './lib/install';
import { startOfflineQueue } from './lib/offlineQueue';
// Registers how attendance saved offline is sent.
import './hooks/useAttendance';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Sends what was saved offline (now, and whenever the connection returns).
void startOfflineQueue();

// Installable app (PWA): register the service worker once the page has loaded.
// Not in development, where it would sit between Vite and the browser.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => void registerServiceWorker());
}
