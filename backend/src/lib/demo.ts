/**
 * Demonstration schools: a school of fictitious data made for one director
 * trying Kiddoo, closed after a date. Their accounts sign in with addresses
 * on a reserved domain that can never receive mail (RFC 2606 ".invalid").
 */
export const DEMO_EMAIL_DOMAIN = 'demo.kiddoo.invalid';

export const DEMO_DAYS = 14;

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** Whether people of this school may use it: active, and not a demonstration past its end. */
export function schoolIsOpen(school: { isActive: boolean; demoExpiresAt?: Date | null }, now: Date = new Date()): boolean {
  return school.isActive && !(school.demoExpiresAt && school.demoExpiresAt <= now);
}
