/**
 * Demonstration schools: a school of fictitious data made for one director
 * trying Kiddoo, closed after a date. Their accounts sign in with addresses
 * on a reserved domain that can never receive mail (RFC 2606 ".invalid").
 */
export const DEMO_EMAIL_DOMAIN = 'demo.kiddoo.invalid';

export const DEMO_DAYS = 14;

/** A real school's trial: how long the director uses it before deciding to subscribe. */
export const TRIAL_DAYS = 15;

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

type SchoolDates = { isActive: boolean; demoExpiresAt?: Date | null; trialEndsAt?: Date | null };

/** A school on trial whose trial is over (and not subscribed since). */
export function trialIsOver(school: SchoolDates, now: Date = new Date()): boolean {
  return !!school.trialEndsAt && school.trialEndsAt <= now;
}

/**
 * Whether people of this school may use it: active, not a demonstration past
 * its end, and not a trial past its end.
 */
export function schoolIsOpen(school: SchoolDates, now: Date = new Date()): boolean {
  return school.isActive && !(school.demoExpiresAt && school.demoExpiresAt <= now) && !trialIsOver(school, now);
}
