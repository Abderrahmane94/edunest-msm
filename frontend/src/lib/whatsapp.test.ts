import { describe, it, expect } from 'vitest';
import i18n from '@/i18n';
import { accessMessage, whatsappLink, whatsappNumber } from './whatsapp';

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

describe('accessMessage', () => {
  const t = i18n.getFixedT('fr');
  const base = { url: 'https://app.kiddooschool.com', login: '0770112233', password: 'Ab3x9KqP' };

  it('a parent: their school, what Kiddoo is for them, the access in bold, who writes', () => {
    const text = accessMessage(t, { ...base, kind: 'new', name: 'Nadia', role: 'parent', school: 'Les Petits Anges', sender: 'Amina B' });
    expect(text).toContain('Bonjour Nadia 👋');
    expect(text).toContain('*Les Petits Anges* vous ouvre votre espace parent');
    expect(text).toContain('https://app.kiddooschool.com/login');
    expect(text).toContain('*0770112233*');
    expect(text).toContain('*Ab3x9KqP*');
    expect(text).toContain("écran d'accueil");
    expect(text.endsWith('— Amina B')).toBe(true);
  });

  it('a new password: no welcome, no home screen tip; signed by the team for a super admin', () => {
    const text = accessMessage(t, { ...base, kind: 'reset', role: 'parent', school: 'Les Petits Anges' });
    expect(text).toContain('nouveau mot de passe temporaire');
    expect(text).not.toContain('espace parent');
    expect(text).not.toContain("écran d'accueil");
    expect(text.endsWith("— L'équipe Kiddoo")).toBe(true);
  });

  it('without a school or a known role, a plain welcome', () => {
    expect(accessMessage(t, { ...base, kind: 'new', role: 'teacher' })).toContain('Un compte a été créé pour vous');
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
