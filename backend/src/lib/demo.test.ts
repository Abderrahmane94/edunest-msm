import { describe, it, expect } from 'vitest';
import { isDemoEmail, schoolIsOpen } from './demo';

describe('demonstration schools', () => {
  const now = new Date('2026-10-20T10:00:00Z');

  it('a real school is open while active', () => {
    expect(schoolIsOpen({ isActive: true, demoExpiresAt: null }, now)).toBe(true);
    expect(schoolIsOpen({ isActive: false, demoExpiresAt: null }, now)).toBe(false);
  });

  it('a demonstration closes at its end, even before anyone closes it', () => {
    expect(schoolIsOpen({ isActive: true, demoExpiresAt: new Date('2026-10-21T00:00:00Z') }, now)).toBe(true);
    expect(schoolIsOpen({ isActive: true, demoExpiresAt: new Date('2026-10-20T09:59:59Z') }, now)).toBe(false);
  });

  it("its accounts' addresses are recognised (no mail is ever sent to them)", () => {
    expect(isDemoEmail('directeur.a1b2@demo.kiddoo.invalid')).toBe(true);
    expect(isDemoEmail('Parent.A1B2@DEMO.KIDDOO.INVALID')).toBe(true);
    expect(isDemoEmail('someone@gmail.com')).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
  });
});
