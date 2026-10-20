import prisma, { type DbClient } from './prisma';

/**
 * Whether this email has another account than `exceptId` (in another school,
 * or on the platform). Each account has its own password, and at sign in the
 * password says which one opens: whoever creates the new one is told, so the
 * person uses its temporary password and not the one they already know.
 * Raw SQL: across schools, outside the current school's scope.
 */
export async function emailHasOtherAccount(email: string | null | undefined, exceptId: string, db: DbClient = prisma): Promise<boolean> {
  if (!email) return false;
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM users
    WHERE deleted_at IS NULL AND lower(email) = lower(${email.trim()}) AND id <> ${exceptId}`;
  return (rows[0]?.n ?? 0) > 0;
}
