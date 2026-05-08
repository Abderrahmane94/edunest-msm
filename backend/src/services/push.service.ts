/**
 * Push notification service using Firebase Cloud Messaging (FCM).
 * In development mode, push notifications are logged to console instead of being sent.
 * Configure FCM_SERVER_KEY environment variable for production use.
 */

interface PushNotificationOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushService {
  private serverKey: string | undefined;
  private isDevelopment: boolean;

  constructor() {
    this.serverKey = process.env.FCM_SERVER_KEY;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  async send(options: PushNotificationOptions): Promise<void> {
    if (this.isDevelopment || !this.serverKey) {
      console.log('[PushService] Development mode - push notification not sent:');
      console.log(`  Token: ${options.token}`);
      console.log(`  Title: ${options.title}`);
      console.log(`  Body: ${options.body}`);
      if (options.data) {
        console.log(`  Data: ${JSON.stringify(options.data)}`);
      }
      return;
    }

    // Production: send via FCM HTTP v1 API
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${this.serverKey}`,
      },
      body: JSON.stringify({
        to: options.token,
        notification: {
          title: options.title,
          body: options.body,
        },
        data: options.data || {},
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[PushService] Failed to send push notification:', errorBody);
      throw new Error(`Failed to send push notification: ${response.status}`);
    }
  }

  async sendToMany(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
    const results = await Promise.allSettled(
      tokens.map((token) => this.send({ token, title, body, data })),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[PushService] ${failures.length}/${tokens.length} push notifications failed`);
    }
  }
}

export const pushService = new PushService();
