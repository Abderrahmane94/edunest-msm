/**
 * What a form may send: the same rules as the server's (utils/validators.ts),
 * checked before sending so the message shows under the field.
 */

/** A person's name: at least two letters of any alphabet, no digits. */
export function isPersonName(value: string): boolean {
  const name = value.trim();
  return /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u.test(name) && (name.match(/\p{L}/gu) ?? []).length >= 2;
}

/** A phone number: digits with the usual separators, an optional leading +. */
export function isPhone(value: string): boolean {
  const phone = value.trim();
  return /^\+?[0-9\s\-().]{6,20}$/.test(phone) && (phone.match(/\d/g) ?? []).length >= 6;
}

/** How old a child of the school can be at most. */
export const MAX_CHILD_AGE_YEARS = 18;

/** The earliest birth date a child's file takes (YYYY-MM-DD). */
export function earliestBirthDate(today: string): string {
  return `${Number(today.slice(0, 4)) - MAX_CHILD_AGE_YEARS - 1}-01-01`;
}
