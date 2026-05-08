/**
 * SMS service using Twilio.
 * In development mode, SMS messages are logged to console instead of being sent.
 * Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
 * environment variables for production use.
 */

interface SendSmsOptions {
  to: string;
  body: string;
}

class SmsService {
  private accountSid: string | undefined;
  private authToken: string | undefined;
  private fromNumber: string | undefined;
  private isDevelopment: boolean;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  async send(options: SendSmsOptions): Promise<void> {
    if (this.isDevelopment || !this.accountSid || !this.authToken || !this.fromNumber) {
      console.log('[SmsService] Development mode - SMS not sent:');
      console.log(`  To: ${options.to}`);
      console.log(`  Body: ${options.body}`);
      return;
    }

    // Production: send via Twilio REST API
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', options.to);
    params.append('From', this.fromNumber);
    params.append('Body', options.body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[SmsService] Failed to send SMS:', errorBody);
      throw new Error(`Failed to send SMS: ${response.status}`);
    }
  }
}

export const smsService = new SmsService();
