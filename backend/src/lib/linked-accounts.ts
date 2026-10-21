import prisma, { type DbClient } from './prisma';
import { accountIdsWithPhone } from './phone-accounts';

/**
 * One person, several accounts: the same email (whatever its case) in
 * several schools or on the platform — or, for accounts without an email,
 * the same phone number. They share one password, and at sign in the person
 * chooses which one to enter (see auth.service login).
 *
 * An account with an email is never tied by its phone number: a phone can be
 * a family's, an email is a person's.
 */
export interface AccountIdentity {
  id?: string;
  email: string | null;
  phone: string | null;
}

/** The person's other accounts (employees who never sign in aside). */
export async function linkedAccountIds(account: AccountIdentity, db: DbClient = prisma): Promise<string[]> {
  const except = account.id ?? '';
  if (account.email) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM users
      WHERE deleted_at IS NULL AND role <> 'staff' AND lower(email) = lower(${account.email.trim()}) AND id <> ${except}`;
    return rows.map((r) => r.id);
  }
  if (!account.phone) return [];
  const withPhone = (await accountIdsWithPhone(account.phone, undefined, db)).filter((id) => id !== except);
  if (withPhone.length === 0) return [];
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id = ANY(${withPhone}::text[]) AND email IS NULL`;
  return rows.map((r) => r.id);
}

/**
 * The password a new account of this person takes: the one of their
 * account used last. Null when the person has no account yet.
 */
export async function linkedPassword(
  account: AccountIdentity,
  db: DbClient = prisma,
): Promise<{ passwordHash: string; mustChangePassword: boolean } | null> {
  const ids = await linkedAccountIds(account, db);
  if (ids.length === 0) return null;
  const rows = await db.$queryRaw<{ password_hash: string; must_change_password: boolean }[]>`
    SELECT password_hash, must_change_password FROM users WHERE id = ANY(${ids}::text[])
    ORDER BY last_active_at DESC NULLS LAST, created_at DESC LIMIT 1`;
  return rows[0] ? { passwordHash: rows[0].password_hash, mustChangePassword: rows[0].must_change_password } : null;
}
