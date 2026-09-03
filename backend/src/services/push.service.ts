/**
 * Push notification service using Firebase Cloud Messaging (FCM) HTTP v1.
 *
 * Delivery uses the firebase-admin SDK, authenticated with a service-account
 * JSON supplied via the FIREBASE_SERVICE_ACCOUNT environment variable (paste
 * the full JSON as a single line). When the credential is absent (typical in
 * local development), push notifications are logged to the console instead of
 * being sent, so the rest of the notification pipeline still works.
 *
 * Web (browser) push:
 *   Browsers obtain an FCM registration token via the Firebase JS SDK + a
 *   service worker (firebase-messaging-sw.js) and send it to the backend
 *   (PATCH /api/users/:id/fcm-token). FCM then delivers to that token using
 *   the standard Web Push protocol under the hood.
 *
 *   Note on iOS: browser web push only works for a PWA the user has added to
 *   the Home Screen (iOS 16.4+); a plain Safari tab will not receive push.
 */

import { initializeApp, getApps, getApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

interface PushNotificationOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushService {
  private messaging: Messaging | null = null;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.initialize();
  }

  /**
   * Initializes the firebase-admin app from FIREBASE_SERVICE_ACCOUNT.
   * Fails soft: if the credential is missing or invalid, messaging stays null
   * and sends are logged instead of dispatched.
   */
  private initialize(): void {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      console.warn(
        '[PushService] FIREBASE_SERVICE_ACCOUNT is not set — push notifications will be logged, not sent.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(raw) as ServiceAccount;
      // Reuse an already-initialized default app if present (avoids duplicate
      // app errors under hot-reload / repeated imports).
      const app = getApps().length
        ? getApp()
        : initializeApp({ credential: cert(serviceAccount) });
      this.messaging = getMessaging(app);
      console.log('[PushService] Firebase Admin initialized — push notifications enabled.');
    } catch (err) {
      console.error(
        '[PushService] Failed to parse FIREBASE_SERVICE_ACCOUNT — push notifications disabled:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Whether real push delivery is configured. When false, sends are no-ops
   * (logged only) so callers never need to branch on configuration.
   */
  get isConfigured(): boolean {
    return this.messaging !== null;
  }

  async send(options: PushNotificationOptions): Promise<void> {
    if (!this.messaging) {
      if (this.isDevelopment) {
        console.log('[PushService] Push not configured — notification not sent:');
        console.log(`  Token: ${options.token.slice(0, 12)}…`);
        console.log(`  Title: ${options.title}`);
        console.log(`  Body: ${options.body}`);
      }
      return;
    }

    try {
      await this.messaging.send({
        token: options.token,
        notification: {
          title: options.title,
          body: options.body,
        },
        data: options.data || {},
        webpush: {
          notification: {
            title: options.title,
            body: options.body,
          },
        },
      });
    } catch (err) {
      // FCM returns a specific error when a token is no longer valid (app
      // uninstalled, permission revoked, token rotated). Surface it distinctly
      // so callers can prune the stored token.
      const code = (err as { code?: string }).code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        throw new PushTokenInvalidError(options.token);
      }
      console.error('[PushService] Failed to send push notification:', err);
      throw err;
    }
  }

  async sendToMany(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const results = await Promise.allSettled(
      tokens.map((token) => this.send({ token, title, body, data })),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[PushService] ${failures.length}/${tokens.length} push notifications failed`);
    }
  }
}

/**
 * Thrown when FCM reports a token is no longer valid, so callers can clear the
 * stored fcmToken for that user.
 */
export class PushTokenInvalidError extends Error {
  token: string;
  constructor(token: string) {
    super('FCM registration token is no longer valid');
    this.name = 'PushTokenInvalidError';
    this.token = token;
  }
}

export const pushService = new PushService();
