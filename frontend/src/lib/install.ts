import * as React from 'react';

/**
 * "Install the app" support (PWA).
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` once the app is installable;
 * the event is kept so a button can open the install prompt later. It can fire
 * before React mounts, so this module listens from startup (imported by
 * main.tsx). iOS Safari has no prompt: users add the app from the Share menu,
 * so the button shows instructions there instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own mini-infobar from showing; the app offers its button.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

/** Running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad (iPadOS reports itself as a Mac with touch). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * How the app can be installed here: 'prompt' (browser install prompt),
 * 'ios' (manual steps from Safari's Share menu) or null (already installed,
 * or the browser can't install it).
 */
export function useInstallMode(): 'prompt' | 'ios' | null {
  const hasPrompt = React.useSyncExternalStore(subscribe, () => deferredPrompt !== null);
  const done = React.useSyncExternalStore(subscribe, () => installed);
  if (done || isStandalone()) return null;
  if (hasPrompt) return 'prompt';
  if (isIos()) return 'ios';
  return null;
}

/** Opens the browser's install prompt (one use per event). */
export async function promptInstall(): Promise<void> {
  const prompt = deferredPrompt;
  if (!prompt) return;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  await prompt.userChoice;
}
