import { describe, it, expect } from 'vitest';
import { normalizePhone, isEmailIdentifier } from './phone';

describe('normalizePhone', () => {
  it('reads an Algerian number however it is written', () => {
    for (const written of ['0555 12 34 56', '0555-12-34-56', '+213 555 12 34 56', '00213 555 12 34 56', '213555123456', '(0555) 12.34.56']) {
      expect(normalizePhone(written)).toBe('0555123456');
    }
  });

  it('keeps landlines and foreign numbers to their digits', () => {
    expect(normalizePhone('021 23 45 67')).toBe('021234567');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('33612345678');
  });
});

describe('isEmailIdentifier', () => {
  it('tells an email from a phone number', () => {
    expect(isEmailIdentifier('fatima@example.dz')).toBe(true);
    expect(isEmailIdentifier('0555 12 34 56')).toBe(false);
  });
});
