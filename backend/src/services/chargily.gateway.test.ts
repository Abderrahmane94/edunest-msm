import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock environment variables before importing the module
vi.stubEnv('CHARGILY_API_KEY', 'test_api_key');
vi.stubEnv('CHARGILY_SECRET_KEY', 'test_secret_key');
vi.stubEnv('NODE_ENV', 'test');

// We need to re-import after env setup
const { chargilyGateway } = await import('./chargily.gateway');

describe('ChargilyGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckout', () => {
    it('should return a mock checkout in non-production mode', async () => {
      const params = {
        amount: 15000,
        currency: 'dzd' as const,
        successUrl: 'http://localhost:5173/payments/success?invoice_id=inv-1',
        failureUrl: 'http://localhost:5173/payments/failure?invoice_id=inv-1',
        webhookUrl: 'http://localhost:5173/api/finance/webhooks/chargily',
        metadata: { invoice_id: 'inv-1', school_id: 'school-1' },
        locale: 'fr' as const,
      };

      const result = await chargilyGateway.createCheckout(params);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('checkoutUrl');
      expect(result.status).toBe('pending');
      expect(result.id).toMatch(/^chk_mock_/);
      expect(result.checkoutUrl).toContain('https://pay.chargily.net/test/checkouts/');
    });

    it('should include the mock checkout id in the URL', async () => {
      const params = {
        amount: 5000,
        currency: 'dzd' as const,
        successUrl: 'http://localhost:5173/payments/success',
        failureUrl: 'http://localhost:5173/payments/failure',
        webhookUrl: 'http://localhost:5173/api/finance/webhooks/chargily',
        metadata: { invoice_id: 'inv-2', school_id: 'school-1' },
        locale: 'ar' as const,
      };

      const result = await chargilyGateway.createCheckout(params);

      expect(result.checkoutUrl).toContain(result.id);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for a valid HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ type: 'checkout.paid', data: { id: 'chk_123' } });
      const secretKey = 'test_secret_key';
      const validSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');

      const result = chargilyGateway.verifyWebhookSignature(payload, validSignature);

      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const payload = JSON.stringify({ type: 'checkout.paid', data: { id: 'chk_123' } });
      const invalidSignature = 'deadbeef'.repeat(8); // 64 hex chars

      const result = chargilyGateway.verifyWebhookSignature(payload, invalidSignature);

      expect(result).toBe(false);
    });

    it('should return false for a tampered payload', () => {
      const originalPayload = JSON.stringify({ type: 'checkout.paid', data: { id: 'chk_123' } });
      const secretKey = 'test_secret_key';
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(originalPayload)
        .digest('hex');

      const tamperedPayload = JSON.stringify({ type: 'checkout.paid', data: { id: 'chk_456' } });

      const result = chargilyGateway.verifyWebhookSignature(tamperedPayload, signature);

      expect(result).toBe(false);
    });

    it('should return false for malformed signature', () => {
      const payload = JSON.stringify({ type: 'checkout.paid' });
      const malformedSignature = 'not-a-hex-string';

      const result = chargilyGateway.verifyWebhookSignature(payload, malformedSignature);

      expect(result).toBe(false);
    });
  });

  describe('getCheckout', () => {
    it('should return a mock checkout status in non-production mode', async () => {
      const result = await chargilyGateway.getCheckout('chk_mock_123');

      expect(result).toEqual({
        id: 'chk_mock_123',
        status: 'pending',
        amount: 0,
        currency: 'dzd',
        metadata: {},
      });
    });
  });
});
