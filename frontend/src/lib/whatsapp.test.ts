import { describe, it, expect } from 'vitest';
import { whatsappLink, whatsappNumber } from './whatsapp';

describe('whatsappNumber', () => {
  it('gives the international number WhatsApp expects', () => {
    for (const written of ['0770 11 22 33', '+213 770 11 22 33', '00213770112233', '213770112233']) {
      expect(whatsappNumber(written)).toBe('213770112233');
    }
    expect(whatsappNumber('+33 6 12 34 56 78')).toBe('33612345678');
  });

  it('none for no number, or too short to be one', () => {
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber('12 34')).toBeNull();
  });
});

describe('whatsappLink', () => {
  it('opens the chat with the message written', () => {
    expect(whatsappLink('0770112233', 'Mot de passe : a&b')).toBe('https://wa.me/213770112233?text=Mot%20de%20passe%20%3A%20a%26b');
  });

  it('lets the sender pick the contact when there is no number', () => {
    expect(whatsappLink(undefined, 'x')).toBe('https://wa.me/?text=x');
  });
});
