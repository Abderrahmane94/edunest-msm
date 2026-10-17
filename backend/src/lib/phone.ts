/**
 * Phone numbers as people type them, made comparable: spaces, dashes and the
 * country code don't count, so "0555 12 34 56", "+213 555 12 34 56" and
 * "00213555123456" are all "0555123456". Other countries' numbers keep their
 * digits as they are.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00213')) return `0${digits.slice(5)}`;
  if (digits.startsWith('213') && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}

/** What one signs in with: an email has an @, anything else is a phone number. */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
