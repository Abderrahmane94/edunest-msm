import { describe, it, expect, vi, afterEach } from 'vitest';
import { showSystemNotification } from './push';

/** A browser where notifications are allowed; the constructor throws as on Android. */
function browser(registration: { showNotification: ReturnType<typeof vi.fn> } | undefined) {
  const Notification = Object.assign(
    vi.fn(() => {
      throw new TypeError("Failed to construct 'Notification': Illegal constructor.");
    }),
    { permission: 'granted' },
  );
  vi.stubGlobal('Notification', Notification);
  vi.stubGlobal('window', { Notification });
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => registration) } });
  return Notification;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('showSystemNotification', () => {
  it('goes through the service worker, as Android requires', async () => {
    const registration = { showNotification: vi.fn(async () => undefined) };
    const Notification = browser(registration);
    await showSystemNotification('Nouveau message', 'Bonjour');
    expect(registration.showNotification).toHaveBeenCalledWith('Nouveau message', expect.objectContaining({ body: 'Bonjour', icon: '/icon-192.png', badge: '/badge-96.png' }));
    expect(Notification).not.toHaveBeenCalled();
  });

  it('one per conversation, Arabic right to left, with the sender photo', async () => {
    const registration = { showNotification: vi.fn(async () => undefined) };
    browser(registration);
    await showSystemNotification('سارة', 'مرحبا', { tag: 'conversation:c1', lang: 'ar', icon: 'https://x/p.jpg' });
    expect(registration.showNotification).toHaveBeenCalledWith('سارة', expect.objectContaining({ tag: 'conversation:c1', renotify: true, dir: 'rtl', lang: 'ar', icon: 'https://x/p.jpg' }));
  });

  it('never throws, even when nothing can show it', async () => {
    browser(undefined);
    await expect(showSystemNotification('Nouveau message')).resolves.toBeUndefined();
  });
});
