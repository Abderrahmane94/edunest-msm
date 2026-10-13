import prisma from '../../lib/prisma';
import {
  absenceOn,
  addDays,
  daysBetween,
  monthBounds,
  monthHours,
  openingGap,
  shiftsOn,
  shiftsProblem,
  weekStartOf,
  weekTypeOf,
  weekdayOf,
  type AbsenceSpan,
  type Shift,
} from './planning.logic';
import type { CreateAbsenceInput, ShiftsInput, UpdateAbsenceInput } from './planning.schema';

export class PlanningServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PlanningServiceError';
  }
}

const STAFF_ROLES = ['admin', 'administrative', 'teacher'] as const;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const day = (date: Date) => date.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

interface StaffAbsenceRow extends AbsenceSpan {
  id: string;
  userId: string;
  note: string | null;
}

class PlanningService {
  /** The school's team: the director, the office staff and the teachers, active. */
  private staff(schoolId: string, onlyUserId?: string) {
    return prisma.user.findMany({
      where: { schoolId, role: { in: [...STAFF_ROLES] }, isActive: true, deletedAt: null, ...(onlyUserId ? { id: onlyUserId } : {}) },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, role: true, staffProfile: { select: { position: true } } },
    });
  }

  private async shiftsOf(schoolId: string, userIds?: string[]): Promise<Map<string, Shift[]>> {
    const rows = await prisma.staffShift.findMany({
      where: { schoolId, ...(userIds ? { userId: { in: userIds } } : {}) },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    const byUser = new Map<string, Shift[]>();
    for (const r of rows) {
      byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), { weekday: r.weekday, week: r.week as Shift['week'], start: r.startTime, end: r.endTime }]);
    }
    return byUser;
  }

  /**
   * The days each person is away between two days: the absences recorded,
   * and the replacements of teachers (who is replaced is away).
   */
  private async awayBetween(schoolId: string, from: string, to: string, userIds?: string[]) {
    const overlap = { startDate: { lte: asDate(to) }, endDate: { gte: asDate(from) } };
    const [absences, substitutions] = await Promise.all([
      prisma.staffAbsence.findMany({ where: { schoolId, ...overlap, ...(userIds ? { userId: { in: userIds } } : {}) }, orderBy: { startDate: 'asc' } }),
      prisma.substitution.findMany({
        where: { schoolId, cancelledAt: null, ...overlap },
        select: {
          id: true, classroomId: true, absentTeacherId: true, substituteUserId: true, startDate: true, endDate: true, reason: true,
          classroom: { select: { name: true } },
          substitute: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    const byUser = new Map<string, (StaffAbsenceRow & { classroom?: string })[]>();
    const push = (userId: string, row: StaffAbsenceRow & { classroom?: string }) => byUser.set(userId, [...(byUser.get(userId) ?? []), row]);
    for (const a of absences) push(a.userId, { id: a.id, userId: a.userId, startDate: day(a.startDate), endDate: day(a.endDate), reason: a.reason, note: a.note });
    // A recorded absence comes first: it is the one that can be changed from the planning.
    for (const s of substitutions) {
      if (s.absentTeacherId && (!userIds || userIds.includes(s.absentTeacherId))) {
        push(s.absentTeacherId, { id: `substitution:${s.id}`, userId: s.absentTeacherId, startDate: day(s.startDate), endDate: day(s.endDate), reason: s.reason, note: null, classroom: s.classroom.name });
      }
    }
    return { byUser, substitutions };
  }

  /**
   * A week of the team, day by day: who works when, who is away, who replaces
   * whom, and what is left uncovered. With `onlyUserId`, that person's week alone.
   */
  async week(schoolId: string, anyDay: string, onlyUserId?: string) {
    const start = weekStartOf(anyDay);
    const days = daysBetween(start, addDays(start, 6));
    const staff = await this.staff(schoolId, onlyUserId);
    const ids = staff.map((u) => u.id);
    const [shifts, away, classrooms] = await Promise.all([
      this.shiftsOf(schoolId, onlyUserId ? ids : undefined),
      this.awayBetween(schoolId, days[0], days[6], onlyUserId ? ids : undefined),
      prisma.classroom.findMany({
        where: { schoolId, deletedAt: null, academicYear: { isActive: true }, ...(onlyUserId ? { teacherUserId: onlyUserId } : {}) },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, color: true, teacherUserId: true, workingDays: true },
      }),
    ]);

    const people = staff.map((u) => {
      const mine = shifts.get(u.id) ?? [];
      const absences = away.byUser.get(u.id) ?? [];
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        position: u.staffProfile?.position ?? null,
        classrooms: classrooms.filter((c) => c.teacherUserId === u.id).map((c) => ({ id: c.id, name: c.name, color: c.color })),
        /** The usual week as recorded (both weeks when it alternates). */
        template: mine,
        days: days.map((d) => {
          const absence = absenceOn(absences, d);
          return {
            date: d,
            shifts: shiftsOn(mine, d).map((s) => ({ start: s.start, end: s.end })),
            absence: absence ? { id: absence.id, reason: absence.reason, note: absence.note, startDate: absence.startDate, endDate: absence.endDate, classroom: absence.classroom ?? null } : null,
            /** Classes taken for a colleague that day. */
            replacing: away.substitutions
              .filter((s) => s.substituteUserId === u.id && day(s.startDate) <= d && d <= day(s.endDate))
              .map((s) => ({ classroomId: s.classroomId, classroom: s.classroom.name })),
          };
        }),
      };
    });

    // What is left uncovered: seen by who manages the team only.
    const alerts: { date: string; kind: 'class' | 'opening' | 'closing'; classroom?: string; teacher?: string; usual?: string; actual?: string | null }[] = [];
    if (!onlyUserId) {
      for (const [i, d] of days.entries()) {
        for (const c of classrooms) {
          if (!c.teacherUserId || !(Array.isArray(c.workingDays) ? c.workingDays : []).includes(WEEKDAYS[weekdayOf(d)])) continue;
          const teacher = people.find((p) => p.id === c.teacherUserId);
          if (!teacher?.days[i].absence) continue;
          const covered = away.substitutions.some((s) => s.classroomId === c.id && s.substituteUserId && day(s.startDate) <= d && d <= day(s.endDate));
          if (!covered) alerts.push({ date: d, kind: 'class', classroom: c.name, teacher: `${teacher.firstName} ${teacher.lastName}` });
        }
        const gap = openingGap(people.map((p) => ({ userId: p.id, shifts: p.days[i].shifts, away: !!p.days[i].absence })));
        if (gap?.opening) alerts.push({ date: d, kind: 'opening', ...gap.opening });
        if (gap?.closing) alerts.push({ date: d, kind: 'closing', ...gap.closing });
      }
    }

    return { start, days, weekType: weekTypeOf(start), alternates: people.some((p) => p.template.some((s) => s.week !== 'all')), people, alerts };
  }

  private async assertStaff(schoolId: string, userId: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId, role: { in: [...STAFF_ROLES] }, deletedAt: null }, select: { id: true } });
    if (!user) throw new PlanningServiceError('Employee not found', 404);
  }

  /** Replaces a person's usual week. */
  async setShifts(schoolId: string, userId: string, input: ShiftsInput): Promise<Shift[]> {
    await this.assertStaff(schoolId, userId);
    const problem = shiftsProblem(input.shifts);
    if (problem) throw new PlanningServiceError(problem, 400);
    await prisma.$transaction([
      prisma.staffShift.deleteMany({ where: { schoolId, userId } }),
      prisma.staffShift.createMany({
        data: input.shifts.map((s) => ({ schoolId, userId, weekday: s.weekday, week: s.week, startTime: s.start, endTime: s.end })),
      }),
    ]);
    return (await this.shiftsOf(schoolId, [userId])).get(userId) ?? [];
  }

  /** The absences recorded that touch a period, latest first. */
  async absences(schoolId: string, from: string, to: string, userId?: string) {
    const rows = await prisma.staffAbsence.findMany({
      where: { schoolId, startDate: { lte: asDate(to) }, endDate: { gte: asDate(from) }, ...(userId ? { userId } : {}) },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    return rows.map((a) => ({ id: a.id, userId: a.userId, user: a.user, startDate: day(a.startDate), endDate: day(a.endDate), reason: a.reason, note: a.note }));
  }

  private async assertNoOverlap(schoolId: string, userId: string, startDate: string, endDate: string, exceptId?: string): Promise<void> {
    const other = await prisma.staffAbsence.findFirst({
      where: { schoolId, userId, startDate: { lte: asDate(endDate) }, endDate: { gte: asDate(startDate) }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw new PlanningServiceError('This person is already recorded away on these dates', 409);
  }

  async createAbsence(schoolId: string, createdByUserId: string, input: CreateAbsenceInput) {
    await this.assertStaff(schoolId, input.userId);
    if (daysBetween(input.startDate, input.endDate).length > 366) throw new PlanningServiceError('An absence cannot last more than a year', 400);
    await this.assertNoOverlap(schoolId, input.userId, input.startDate, input.endDate);
    const a = await prisma.staffAbsence.create({
      data: { schoolId, userId: input.userId, startDate: asDate(input.startDate), endDate: asDate(input.endDate), reason: input.reason, note: input.note ?? null, createdByUserId },
    });
    return { id: a.id, userId: a.userId, startDate: day(a.startDate), endDate: day(a.endDate), reason: a.reason, note: a.note };
  }

  async updateAbsence(id: string, schoolId: string, input: UpdateAbsenceInput) {
    const absence = await prisma.staffAbsence.findFirst({ where: { id, schoolId } });
    if (!absence) throw new PlanningServiceError('Absence not found', 404);
    const startDate = input.startDate ?? day(absence.startDate);
    const endDate = input.endDate ?? day(absence.endDate);
    if (endDate < startDate) throw new PlanningServiceError('The end date cannot be before the start date', 400);
    if (daysBetween(startDate, endDate).length > 366) throw new PlanningServiceError('An absence cannot last more than a year', 400);
    await this.assertNoOverlap(schoolId, absence.userId, startDate, endDate, id);
    const a = await prisma.staffAbsence.update({
      where: { id },
      data: { startDate: asDate(startDate), endDate: asDate(endDate), ...(input.reason !== undefined && { reason: input.reason }), ...(input.note !== undefined && { note: input.note }) },
    });
    return { id: a.id, userId: a.userId, startDate: day(a.startDate), endDate: day(a.endDate), reason: a.reason, note: a.note };
  }

  async deleteAbsence(id: string, schoolId: string): Promise<void> {
    const absence = await prisma.staffAbsence.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!absence) throw new PlanningServiceError('Absence not found', 404);
    await prisma.staffAbsence.delete({ where: { id } });
  }

  /**
   * A month, person by person: hours planned, hours away, hours worked, days
   * away by reason. For the month in progress, up to today.
   */
  async summary(schoolId: string, month: string, today: string, onlyUserId?: string) {
    const [first, last] = monthBounds(month);
    const staff = await this.staff(schoolId, onlyUserId);
    const ids = staff.map((u) => u.id);
    const [shifts, away] = await Promise.all([this.shiftsOf(schoolId, onlyUserId ? ids : undefined), this.awayBetween(schoolId, first, last, onlyUserId ? ids : undefined)]);
    const until = first <= today && today < last ? today : undefined;
    return {
      month,
      /** The last day counted, when the month is not over. */
      until: until ?? null,
      people: staff.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        position: u.staffProfile?.position ?? null,
        hasWeek: (shifts.get(u.id) ?? []).length > 0,
        ...monthHours(shifts.get(u.id) ?? [], away.byUser.get(u.id) ?? [], month, until),
      })),
    };
  }
}

export const planningService = new PlanningService();
