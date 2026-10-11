import prisma, { type DbClient } from '../../lib/prisma';
import { schoolToday } from '../admin/dashboard.service';

/** A day as stored in @db.Date columns (UTC midnight); today in the school's time zone by default. */
export function asDay(day?: string | Date): Date {
  if (day instanceof Date) return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  return new Date(`${(day ?? schoolToday()).slice(0, 10)}T00:00:00.000Z`);
}

/** Replacements in force on a day (not cancelled, the day within their dates). */
export const inForceOn = (day: Date) => ({ cancelledAt: null, startDate: { lte: day }, endDate: { gte: day } });

/**
 * Whether a teacher works with a class on a day: it is their class, or they
 * replace its teacher that day.
 */
export async function teachesClassroom(
  userId: string,
  classroom: { id: string; teacherUserId: string | null },
  day?: string | Date,
  db: DbClient = prisma,
): Promise<boolean> {
  if (classroom.teacherUserId === userId) return true;
  const replacing = await db.substitution.findFirst({
    where: { classroomId: classroom.id, substituteUserId: userId, ...inForceOn(asDay(day)) },
    select: { id: true },
  });
  return !!replacing;
}

/** The classes a teacher works with on a day: their own, and those they replace that day. */
export async function teacherClassroomIds(
  userId: string,
  schoolId: string,
  day?: string | Date,
  db: DbClient = prisma,
): Promise<string[]> {
  const [own, replacing] = await Promise.all([
    db.classroom.findMany({ where: { schoolId, teacherUserId: userId }, select: { id: true } }),
    db.substitution.findMany({
      where: { schoolId, substituteUserId: userId, ...inForceOn(asDay(day)) },
      select: { classroomId: true },
    }),
  ]);
  return [...new Set([...own.map((c) => c.id), ...replacing.map((r) => r.classroomId)])];
}
