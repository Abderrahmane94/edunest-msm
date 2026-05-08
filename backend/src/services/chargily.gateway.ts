/**
 * Chargily Pay V2 API Gateway
 *
 * Handles checkout session creation, webhook signature verification,
 * and checkout status retrieval. Supports Edahabia and CIB payment methods.
 *
 * In development mode, returns mock checkout URLs.
 * In production, calls the Chargily Pay V2 API.
 *
 * Environment variables:
 * - CHARGILY_API_KEY: API key for Chargily Pay
 * - CHARGILY_SECRET_KEY: Secret key for webhook signature verification
 * - APP_URL: Base URL for success/failure/webhook URLs
 */

import crypto from 'crypto';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CheckoutParams {
  amount: number;
  currency: 'dzd';
  successUrl: string;
  failureUrl: string;
  webhookUrl: string;
  metadata: { invoice_id: string; school_id: string };
  locale: 'ar' | 'fr';
}

export interface CheckoutResult {
  id: string;
  checkoutUrl: string;
  status: 'pending';
}

export interface CheckoutStatus {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

export interface IChargilyGateway {
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  getCheckout(checkoutId: string): Promise<CheckoutStatus>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

class ChargilyGateway implements IChargilyGateway {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly baseUrl = 'https://pay.chargily.net/api/v2';

  constructor() {
    this.apiKey = process.env.CHARGILY_API_KEY || '';
    this.secretKey = process.env.CHARGILY_SECRET_KEY || '';
  }

  /**
   * Create a Chargily checkout session.
   * In development mode, returns a mock checkout URL.
   * In production, calls the Chargily Pay V2 API.
   */
  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    if (process.env.NODE_ENV !== 'production') {
      return this.createMockCheckout(params);
    }

    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        success_url: params.successUrl,
        failure_url: params.failureUrl,
        webhook_endpoint: params.webhookUrl,
        locale: params.locale,
        metadata: params.metadata,
        payment_method: null, // Allow both Edahabia and CIB
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[ChargilyGateway] Checkout creation failed:', response.status, errorBody);
      throw new Error(`Chargily checkout creation failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      checkoutUrl: data.checkout_url,
      status: 'pending',
    };
  }

  /**
   * Verify the HMAC-SHA256 webhook signature from Chargily.
   * The signature is computed over the raw request body using the secret key.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.secretKey) {
      console.warn('[ChargilyGateway] No secret key configured, cannot verify webhook signature');
      return false;
    }

    const computedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Get the current status of a checkout session.
   * In development mode, returns a mock status.
   */
  async getCheckout(checkoutId: string): Promise<CheckoutStatus> {
    if (process.env.NODE_ENV !== 'production') {
      return {
        id: checkoutId,
        status: 'pending',
        amount: 0,
        currency: 'dzd',
        metadata: {},
      };
    }

    const response = await fetch(`${this.baseUrl}/checkouts/${checkoutId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[ChargilyGateway] Get checkout failed:', response.status, errorBody);
      throw new Error(`Chargily get checkout failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      metadata: data.metadata || {},
    };
  }

  /**
   * Create a mock checkout for development/testing.
   */
  private createMockCheckout(params: CheckoutParams): CheckoutResult {
    const mockId = `chk_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const mockUrl = `https://pay.chargily.net/test/checkouts/${mockId}`;

    console.log('[ChargilyGateway] Mock checkout created:', {
      id: mockId,
      amount: params.amount,
      currency: params.currency,
      invoiceId: params.metadata.invoice_id,
    });

    return {
      id: mockId,
      checkoutUrl: mockUrl,
      status: 'pending',
    };
  }
}

export const chargilyGateway = new ChargilyGateway();
