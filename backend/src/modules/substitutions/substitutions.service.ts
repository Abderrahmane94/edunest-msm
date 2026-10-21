import prisma, { type DbClient } from '../../lib/prisma';
import { notificationService } from '../../services/notification.service';
import { usersService } from '../users/users.service';
import { asDay, inForceOn } from './teaching-access';
import type { CreateSubstitutionInput, UpdateSubstitutionInput } from './substitutions.schema';

export class SubstitutionServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'SUBSTITUTION_ERROR',
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SubstitutionServiceError';
  }
}

const person = { select: { id: true, firstName: true, lastName: true } };
const include = {
  classroom: { select: { id: true, name: true, academicYearId: true } },
  absentTeacher: person,
  substitute: person,
  createdBy: person,
};

const fullName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';

/** "le 12/10/2026" / "du 12/10 au 16/10/2026", in the reader's language. */
function period(start: Date, end: Date, lang: string): string {
  const d = (x: Date, year = true) =>
    `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}${year ? `/${x.getUTCFullYear()}` : ''}`;
  const same = start.getTime() === end.getTime();
  if (lang === 'ar') return same ? `يوم ${d(start)}` : `من ${d(start, false)} إلى ${d(end)}`;
  return same ? `le ${d(start)}` : `du ${d(start, false)} au ${d(end)}`;
}

class SubstitutionsService {
  /** Replacements of the school, latest first: of a class, of a teacher (away or replacing), in force on a day. */
  list(
    schoolId: string,
    filters: { classroomId?: string; userId?: string; on?: string; includeCancelled?: boolean } = {},
  ) {
    return prisma.substitution.findMany({
      where: {
        schoolId,
        ...(filters.includeCancelled ? {} : { cancelledAt: null }),
        ...(filters.classroomId ? { classroomId: filters.classroomId } : {}),
        ...(filters.userId ? { OR: [{ absentTeacherId: filters.userId }, { substituteUserId: filters.userId }] } : {}),
        ...(filters.on ? inForceOn(asDay(filters.on)) : {}),
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include,
    });
  }

  /**
   * Records a replacement — for today only or a planned period. A substitute
   * from outside the school gets a teacher account made with it. Refused when
   * the class already has one on those days; a substitute already replacing
   * elsewhere needs `allowBusySubstitute`.
   */
  async create(schoolId: string, createdByUserId: string, input: CreateSubstitutionInput) {
    const classroom = await prisma.classroom.findFirst({
      where: { id: input.classroomId, schoolId, deletedAt: null },
      include: { academicYear: true },
    });
    if (!classroom) throw new SubstitutionServiceError('Classroom not found', 404);
    const start = asDay(input.startDate);
    const end = asDay(input.endDate);
    this.assertWithinYear(start, end, classroom.academicYear);

    const result = await prisma.$transaction(async (tx) => {
      let substituteId = input.substituteUserId;
      let newSubstitute = false;
      let temporaryPassword: string | null = null;
      let linkedAccount = false;
      if (input.newSubstitute) {
        const user = await usersService.createDirectly(
          schoolId,
          { ...input.newSubstitute, role: 'teacher', preferredLanguage: 'fr' },
          tx,
        );
        substituteId = user.id;
        newSubstitute = true;
        temporaryPassword = user.temporaryPassword; // none when the teacher already has an account elsewhere
        linkedAccount = user.linkedAccount;
      }
      await this.check(tx, schoolId, classroom, substituteId, start, end, input.allowBusySubstitute);
      const substitution = await tx.substitution.create({
        data: {
          schoolId,
          classroomId: classroom.id,
          absentTeacherId: classroom.teacherUserId,
          substituteUserId: substituteId,
          startDate: start,
          endDate: end,
          reason: input.reason,
          note: input.note || null,
          parentsNotified: input.notifyParents && !!substituteId,
          createdByUserId,
        },
        include,
      });
      return { substitution, newSubstitute, temporaryPassword, linkedAccount };
    });

    void this.notify(result.substitution, input.notifyParents);
    return result;
  }

  async update(id: string, schoolId: string, input: UpdateSubstitutionInput) {
    const current = await this.find(id, schoolId);
    if (current.cancelledAt) throw new SubstitutionServiceError('This replacement was cancelled', 400);
    const classroom = await prisma.classroom.findFirstOrThrow({
      where: { id: current.classroomId },
      include: { academicYear: true },
    });
    const start = input.startDate ? asDay(input.startDate) : current.startDate;
    const end = input.endDate ? asDay(input.endDate) : current.endDate;
    if (start > end) throw new SubstitutionServiceError('The end date must be on or after the start date', 400);
    this.assertWithinYear(start, end, classroom.academicYear);
    const substituteId = input.substituteUserId !== undefined ? input.substituteUserId : current.substituteUserId;

    const updated = await prisma.$transaction(async (tx) => {
      await this.check(tx, schoolId, classroom, substituteId, start, end, input.allowBusySubstitute, id);
      return tx.substitution.update({
        where: { id },
        data: {
          substituteUserId: substituteId,
          startDate: start,
          endDate: end,
          ...(input.reason !== undefined && { reason: input.reason }),
          ...(input.note !== undefined && { note: input.note || null }),
        },
        include,
      });
    });
    // A new substitute is told.
    if (substituteId && substituteId !== current.substituteUserId) void this.notify(updated, false);
    return updated;
  }

  /** The teacher is back: the replacement ends today (one that hasn't started is cancelled). */
  async endToday(id: string, schoolId: string) {
    const current = await this.find(id, schoolId);
    if (current.cancelledAt) throw new SubstitutionServiceError('This replacement was cancelled', 400);
    const today = asDay();
    if (current.endDate < today) throw new SubstitutionServiceError('This replacement has already ended', 400);
    if (current.startDate > today) return this.cancel(id, schoolId);
    return prisma.substitution.update({ where: { id }, data: { endDate: today }, include });
  }

  async cancel(id: string, schoolId: string) {
    await this.find(id, schoolId);
    return prisma.substitution.update({ where: { id }, data: { cancelledAt: new Date() }, include });
  }

  /**
   * The classes a teacher works with today: their own (current school year)
   * and those they replace, with who they replace and until when.
   */
  async myClasses(userId: string, schoolId: string) {
    const today = asDay();
    const [own, replacing] = await Promise.all([
      prisma.classroom.findMany({
        where: { schoolId, teacherUserId: userId, deletedAt: null, academicYear: { isActive: true } },
        orderBy: { name: 'asc' },
      }),
      prisma.substitution.findMany({
        where: { schoolId, substituteUserId: userId, ...inForceOn(today) },
        include: { classroom: true, absentTeacher: person },
        orderBy: { startDate: 'asc' },
      }),
    ]);
    const shape = (c: { id: string; name: string; level: string | null; capacity: number; academicYearId: string }) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      capacity: c.capacity,
      academicYearId: c.academicYearId,
    });
    return [
      ...own.map((c) => ({ ...shape(c), substitution: null })),
      ...replacing
        .filter((r) => !own.some((c) => c.id === r.classroomId))
        .map((r) => ({
          ...shape(r.classroom),
          substitution: {
            id: r.id,
            absentTeacherName: fullName(r.absentTeacher),
            startDate: r.startDate,
            endDate: r.endDate,
          },
        })),
    ];
  }

  private assertWithinYear(start: Date, end: Date, year: { startDate: Date; endDate: Date }) {
    if (start < year.startDate || end > year.endDate) {
      throw new SubstitutionServiceError("The dates must be within the class's school year", 400);
    }
  }

  /** The substitute can take the class, and nothing clashes on those days. */
  private async check(
    db: DbClient,
    schoolId: string,
    classroom: { id: string; teacherUserId: string | null },
    substituteId: string | null | undefined,
    start: Date,
    end: Date,
    allowBusy: boolean,
    exceptId?: string,
  ) {
    const overlapping = { cancelledAt: null, startDate: { lte: end }, endDate: { gte: start }, ...(exceptId ? { id: { not: exceptId } } : {}) };
    const clash = await db.substitution.findFirst({ where: { classroomId: classroom.id, ...overlapping } });
    if (clash) {
      throw new SubstitutionServiceError('This class already has a replacement on these dates', 409, 'CLASS_ALREADY_REPLACED');
    }
    if (!substituteId) return;
    if (substituteId === classroom.teacherUserId) {
      throw new SubstitutionServiceError("The substitute is the class's own teacher", 400);
    }
    const substitute = await db.user.findFirst({
      where: { id: substituteId, schoolId, role: 'teacher', isActive: true },
      select: { id: true },
    });
    if (!substitute) throw new SubstitutionServiceError('The substitute must be an active teacher of the school', 400);
    if (!allowBusy) {
      const busy = await db.substitution.findFirst({
        where: { substituteUserId: substituteId, ...overlapping },
        include: { classroom: { select: { name: true } } },
      });
      if (busy) {
        throw new SubstitutionServiceError(
          `The substitute already replaces in ${busy.classroom.name} on these dates`,
          409,
          'SUBSTITUTE_BUSY',
          { classroom: busy.classroom.name },
        );
      }
    }
  }

  private async find(id: string, schoolId: string) {
    const s = await prisma.substitution.findFirst({ where: { id, schoolId } });
    if (!s) throw new SubstitutionServiceError('Replacement not found', 404);
    return s;
  }

  /** Tells the substitute, and the class's parents when asked; each in their language. */
  private async notify(
    s: {
      classroomId: string;
      startDate: Date;
      endDate: Date;
      substituteUserId: string | null;
      classroom: { name: string };
      absentTeacher: { firstName: string; lastName: string } | null;
      substitute: { firstName: string; lastName: string } | null;
    },
    toParents: boolean,
  ) {
    try {
      if (!s.substituteUserId) return;
      const absent = fullName(s.absentTeacher);
      const sub = await prisma.user.findUnique({ where: { id: s.substituteUserId }, select: { preferredLanguage: true } });
      const lang = sub?.preferredLanguage ?? 'fr';
      await notificationService.notify({
        userId: s.substituteUserId,
        type: 'substitution',
        referenceType: 'classroom',
        referenceId: s.classroomId,
        channels: ['push'],
        title: lang === 'ar' ? 'تعويض' : 'Remplacement',
        body:
          lang === 'ar'
            ? `${absent ? `ستعوّض ${absent} في قسم` : 'ستتكفّل بقسم'} ${s.classroom.name} ${period(s.startDate, s.endDate, 'ar')}.`
            : `${absent ? `Vous remplacez ${absent} en classe` : 'Vous prenez la classe'} ${s.classroom.name} ${period(s.startDate, s.endDate, 'fr')}.`,
      });

      if (!toParents) return;
      const parents = await prisma.parentChildLink.findMany({
        where: { child: { enrollments: { some: { classroomId: s.classroomId } } } },
        select: { parent: { select: { id: true, preferredLanguage: true } } },
      });
      const byLang = new Map<string, string[]>();
      for (const { parent: parentUser } of parents) {
        const list = byLang.get(parentUser.preferredLanguage) ?? [];
        if (!list.includes(parentUser.id)) list.push(parentUser.id);
        byLang.set(parentUser.preferredLanguage, list);
      }
      const subName = fullName(s.substitute);
      for (const [l, ids] of byLang) {
        await notificationService.notifyMany(ids, {
          type: 'substitution',
          referenceType: 'classroom',
          referenceId: s.classroomId,
          channels: ['push'],
          title: l === 'ar' ? `تعويض في قسم ${s.classroom.name}` : `Remplacement en classe ${s.classroom.name}`,
          body:
            l === 'ar'
              ? `${subName} ${absent ? `تعوّض ${absent}` : 'تتكفّل بالقسم'} ${period(s.startDate, s.endDate, 'ar')}.`
              : `${subName} ${absent ? `remplace ${absent}` : 'prend la classe'} ${period(s.startDate, s.endDate, 'fr')}.`,
        });
      }
    } catch (err) {
      // A notification that fails never undoes the replacement.
      console.error('[substitutions] notification failed', err);
    }
  }
}

export const substitutionsService = new SubstitutionsService();
