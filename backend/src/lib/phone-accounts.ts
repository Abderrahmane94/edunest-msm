import prisma, { type DbClient } from './prisma';
import { normalizePhone } from './phone';

/**
 * The active accounts with this phone number (employees who never sign in
 * aside), however each was written (see
 * normalizePhone, which the SQL below repeats), in one school or in all.
 * Raw SQL: the comparison is on the cleaned-up number, which Prisma can't express.
 */
export async function accountIdsWithPhone(phone: string, schoolId?: string, db: DbClient = prisma): Promise<string[]> {
  const wanted = normalizePhone(phone);
  if (wanted.length < 6) return [];
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT id, school_id, regexp_replace(phone, '[^0-9]', '', 'g') AS d
      FROM users WHERE deleted_at IS NULL AND phone IS NOT NULL AND role <> 'staff'
    ) u
    WHERE (CASE
      WHEN d LIKE '00213%' THEN '0' || substr(d, 6)
      WHEN d LIKE '213%' AND length(d) = 12 THEN '0' || substr(d, 4)
      ELSE d END) = ${wanted}`;
  if (schoolId === undefined) return rows.map((r) => r.id);
  const inSchool = await db.user.findMany({ where: { id: { in: rows.map((r) => r.id) }, schoolId }, select: { id: true } });
  return inSchool.map((r) => r.id);
}
