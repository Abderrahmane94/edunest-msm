import { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';
import { childrenService } from '../children/children.service';
import { enrollmentService } from '../payments/enrollment.service';
import { AcademicYearServiceError } from './academic-years.service';
import type { ClassTarget, YearRolloverInput } from './year-rollover.schema';
import { unpaidByYear } from '../payments/unpaid-by-year';

/** A date moved by whole years (29 February becomes the 28th). */
function shiftYears(d: Date, years: number): Date {
  const y = d.getUTCFullYear() + years;
  const m = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)));
}

const targetKey = (t: ClassTarget | null): string =>
  !t ? 'none' : 'copyOf' in t ? `copy:${t.copyOf}` : `class:${t.classroomId}`;

class YearRolloverService {
  /** Both years, the source defaulting to the one just before the target. */
  private async years(schoolId: string, targetYearId: string, sourceYearId?: string) {
    const years = await prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startDate: 'asc' } });
    const target = years.find((y) => y.id === targetYearId);
    if (!target) throw new AcademicYearServiceError('Academic year not found', 404);
    const source = sourceYearId
      ? years.find((y) => y.id === sourceYearId)
      : [...years].reverse().find((y) => y.startDate < target.startDate);
    if (sourceYearId && !source) throw new AcademicYearServiceError('Source academic year not found', 404);
    if (source?.id === target.id) {
      throw new AcademicYearServiceError('Choose another year to copy from', 400);
    }
    return { target, source: source ?? null, years };
  }

  /** The children of a year: registered in it, placed in one of its classes or billed in it. */
  private childrenOfYear(schoolId: string, yearId: string, db: DbClient = prisma) {
    return db.child.findMany({
      where: {
        schoolId,
        OR: [
          { academicYearId: yearId },
          { enrollments: { some: { classroom: { academicYearId: yearId, deletedAt: null } } } },
          { paymentEnrollments: { some: { academicYearId: yearId } } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });
  }

  /**
   * Everything the "prepare the year" assistant shows: the source year's
   * classes, calendar, fees and children, and what the new year already has.
   */
  async preview(schoolId: string, targetYearId: string, sourceYearId?: string) {
    const { target, source, years } = await this.years(schoolId, targetYearId, sourceYearId);
    const yearInfo = (y: typeof target) => ({ id: y.id, name: y.name, startDate: y.startDate, endDate: y.endDate });
    const others = years.filter((y) => y.id !== target.id).map(yearInfo);
    if (!source) {
      return { target: yearInfo(target), source: null, otherYears: others, classes: [], targetClasses: [], calendar: [], fees: [], children: [] };
    }

    const classSelect = {
      id: true,
      name: true,
      level: true,
      capacity: true,
      workingDays: true,
      teacher: { select: { id: true, firstName: true, lastName: true, isActive: true } },
      room: { select: { id: true, name: true, isActive: true } },
      feeAssignments: { select: { branchFeeId: true } },
      _count: { select: { enrollments: true } },
    } as const;
    const [classes, targetClasses, branches, fees, children] = await Promise.all([
      prisma.classroom.findMany({
        where: { schoolId, academicYearId: source.id, deletedAt: null },
        orderBy: { name: 'asc' },
        select: classSelect,
      }),
      prisma.classroom.findMany({
        where: { schoolId, academicYearId: target.id, deletedAt: null },
        orderBy: { name: 'asc' },
        select: classSelect,
      }),
      prisma.branch.findMany({
        where: { schoolId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          calendars: {
            where: { academicYearId: { in: [source.id, target.id] } },
            orderBy: { periodStart: 'asc' },
            select: { academicYearId: true, label: true, periodStart: true, periodEnd: true },
          },
        },
      }),
      prisma.branchFee.findMany({
        where: { isActive: true, branch: { schoolId, deletedAt: null } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, amount: true, billingCycle: true, appliesToSchool: true },
      }),
      this.childrenOfYear(schoolId, source.id),
    ]);

    const childIds = children.map((c) => c.id);
    const [placements, billings, unpaid] = await Promise.all([
      prisma.classroomEnrollment.findMany({
        where: { childId: { in: childIds }, classroom: { academicYearId: { in: [source.id, target.id] }, deletedAt: null } },
        select: { childId: true, classroom: { select: { id: true, academicYearId: true } } },
      }),
      prisma.enrollment.findMany({
        where: { childId: { in: childIds }, academicYearId: { in: [source.id, target.id] } },
        select: {
          childId: true,
          academicYearId: true,
          status: true,
          billingPeriods: { where: { cancelledAt: null, branchFeeId: { not: null } }, select: { branchFeeId: true } },
        },
      }),
      unpaidByYear(childIds, target.id),
    ]);

    const shift = target.startDate.getUTCFullYear() - source.startDate.getUTCFullYear();
    const recurring = new Set(fees.filter((f) => f.billingCycle).map((f) => f.id));
    const mapClass = (c: (typeof classes)[number]) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      capacity: c.capacity,
      workingDays: c.workingDays,
      childCount: c._count.enrollments,
      // Teachers who left and rooms put aside aren't carried over.
      teacher: c.teacher?.isActive ? { id: c.teacher.id, name: `${c.teacher.firstName} ${c.teacher.lastName}` } : null,
      room: c.room?.isActive ? { id: c.room.id, name: c.room.name } : null,
      feeIds: c.feeAssignments.map((a) => a.branchFeeId),
    });

    return {
      target: yearInfo(target),
      source: yearInfo(source),
      otherYears: others,
      classes: classes.map(mapClass),
      targetClasses: targetClasses.map(mapClass),
      calendar: branches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        targetCount: b.calendars.filter((e) => e.academicYearId === target.id).length,
        entries: b.calendars
          .filter((e) => e.academicYearId === source.id)
          .map((e) => ({
            label: e.label,
            periodStart: shiftYears(e.periodStart, shift),
            periodEnd: shiftYears(e.periodEnd, shift),
          })),
      })),
      fees: fees.map((f) => ({ ...f, amount: f.amount.toFixed(2) })),
      children: children.map((c) => {
        const sourceBilling = billings.find((b) => b.childId === c.id && b.academicYearId === source.id);
        return {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          isActive: c.isActive,
          withdrawn: sourceBilling?.status === 'withdrawn',
          sourceClassroomId: placements.find((p) => p.childId === c.id && p.classroom.academicYearId === source.id)?.classroom.id ?? null,
          targetClassroomId: placements.find((p) => p.childId === c.id && p.classroom.academicYearId === target.id)?.classroom.id ?? null,
          billedInTarget: billings.some((b) => b.childId === c.id && b.academicYearId === target.id),
          // Recurring fees billed last year: kept where the new class offers them.
          feeIds: [...new Set((sourceBilling?.billingPeriods ?? []).map((p) => p.branchFeeId!))].filter((id) => recurring.has(id)),
          unpaid: unpaid.get(c.id) ?? [],
        };
      }),
    };
  }

  /**
   * Prepares a school year from another one, in one transaction: new fee
   * amounts, the billing calendar a year later, copies of the classes (teacher,
   * room, days, fee links), and the children enrolled again in their class and
   * billed. Unpaid charges stay in their own year.
   */
  async run(schoolId: string, targetYearId: string, input: YearRolloverInput) {
    const { target, source } = await this.years(schoolId, targetYearId, input.sourceYearId);
    if (!source) throw new AcademicYearServiceError('Source academic year not found', 404);

    if (input.billing) {
      const start = new Date(input.billing.startDate);
      if (start < target.startDate || start > target.endDate) {
        throw new AcademicYearServiceError('The billing start date must be within the new school year', 400);
      }
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. New fee amounts, before anyone is billed.
        let feesUpdated = 0;
        for (const { feeId, amount } of input.feeAmounts) {
          const fee = await tx.branchFee.findFirst({ where: { id: feeId, branch: { schoolId } } });
          if (!fee) throw new AcademicYearServiceError('Fee not found', 404);
          if (fee.amount.equals(new Prisma.Decimal(amount))) continue;
          await tx.branchFee.update({ where: { id: feeId }, data: { amount: new Prisma.Decimal(amount) } });
          feesUpdated++;
        }

        // 2. The billing calendar a year later, where the new year has none yet.
        let calendarCopied = 0;
        const shift = target.startDate.getUTCFullYear() - source.startDate.getUTCFullYear();
        if (input.copyCalendar && shift !== 0) {
          const branches = await tx.branch.findMany({ where: { schoolId, deletedAt: null }, select: { id: true } });
          for (const { id: branchId } of branches) {
            if (await tx.branchCalendar.count({ where: { branchId, academicYearId: target.id } })) continue;
            const entries = await tx.branchCalendar.findMany({
              where: { branchId, academicYearId: source.id },
              include: { feeAssignments: { select: { branchFeeId: true } } },
            });
            for (const e of entries) {
              const copy = await tx.branchCalendar.create({
                data: {
                  branchId,
                  academicYearId: target.id,
                  label: e.label,
                  periodStart: shiftYears(e.periodStart, shift),
                  periodEnd: shiftYears(e.periodEnd, shift),
                },
              });
              if (e.feeAssignments.length) {
                await tx.branchFeePeriod.createMany({
                  data: e.feeAssignments.map((a) => ({ branchFeeId: a.branchFeeId, branchCalendarId: copy.id })),
                });
              }
              calendarCopied++;
            }
          }
        }

        // 3. Copies of the classes.
        const copies = new Map<string, string>();
        for (const { sourceClassroomId, name } of input.classes) {
          const c = await tx.classroom.findFirst({
            where: { id: sourceClassroomId, schoolId, academicYearId: source.id, deletedAt: null },
            include: { teacher: true, room: true, feeAssignments: true },
          });
          if (!c) throw new AcademicYearServiceError('Classroom not found', 404);
          const copy = await tx.classroom.create({
            data: {
              schoolId,
              academicYearId: target.id,
              name,
              capacity: c.capacity,
              level: c.level,
              workingDays: c.workingDays ?? undefined,
              teacherUserId: c.teacher?.isActive && c.teacher.role === 'teacher' ? c.teacher.id : null,
              roomId: c.room?.isActive ? c.room.id : null,
            },
          });
          if (c.feeAssignments.length) {
            await tx.branchFeeClassroom.createMany({
              data: c.feeAssignments.map((a) => ({ branchFeeId: a.branchFeeId, classroomId: copy.id })),
            });
          }
          copies.set(sourceClassroomId, copy.id);
        }

        const resolve = async (t: ClassTarget | null): Promise<string | null> => {
          if (!t) return null;
          if ('copyOf' in t) {
            const id = copies.get(t.copyOf);
            if (!id) throw new AcademicYearServiceError('A child is sent to a class that is not copied', 400);
            return id;
          }
          const c = await tx.classroom.findFirst({
            where: { id: t.classroomId, schoolId, academicYearId: target.id, deletedAt: null },
            select: { id: true },
          });
          if (!c) throw new AcademicYearServiceError('Classroom not found in the new school year', 404);
          return c.id;
        };

        // 4. The children, in their class and billed.
        const sourceChildren = new Set((await this.childrenOfYear(schoolId, source.id, tx)).map((c) => c.id));
        const extraFees = new Map((input.billing?.extraFees ?? []).map((e) => [targetKey(e.target), e.feeIds]));
        const defaultBranch = await tx.branch.findFirst({
          where: { schoolId, deletedAt: null, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        let childrenPlaced = 0;
        let childrenBilled = 0;
        for (const { childId, target: classTarget } of input.children) {
          if (!sourceChildren.has(childId)) throw new AcademicYearServiceError('Child not found', 404);
          const child = await tx.child.findFirst({
            where: { id: childId },
            select: { firstName: true, lastName: true },
          });
          const classroomId = await resolve(classTarget);
          if (classroomId) {
            const already = await tx.classroomEnrollment.findFirst({ where: { childId, classroomId } });
            if (!already) {
              try {
                await childrenService.enrollInClassroom(childId, schoolId, { classroomId }, tx);
              } catch (err) {
                throw new AcademicYearServiceError(
                  `${child?.firstName} ${child?.lastName}: ${err instanceof Error ? err.message : 'not placed'}`,
                  err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 400,
                );
              }
              childrenPlaced++;
            }
          }

          if (!input.billing) continue;
          if (await tx.enrollment.findFirst({ where: { childId, academicYearId: target.id } })) continue;
          const previous = await tx.enrollment.findFirst({
            where: { childId, academicYearId: source.id },
            include: { billingPeriods: { where: { cancelledAt: null }, select: { branchFeeId: true } } },
          });
          const branchId = previous?.branchId ?? defaultBranch?.id;
          if (!branchId) throw new AcademicYearServiceError('The school has no branch to bill from', 400);
          // Last year's recurring fees, where still offered: linked to the new
          // class, or to no class at all (assigned by hand).
          const kept = await tx.branchFee.findMany({
            where: {
              id: { in: (previous?.billingPeriods ?? []).map((p) => p.branchFeeId).filter((id): id is string => !!id) },
              isActive: true,
              appliesToSchool: false,
              branchId,
              billingCycle: { not: null },
              ...(classroomId
                ? { OR: [{ classroomAssignments: { some: { classroomId } } }, { classroomAssignments: { none: {} } }] }
                : {}),
            },
            select: { id: true },
          });
          const feeIds = [...new Set([...kept.map((f) => f.id), ...(extraFees.get(targetKey(classTarget)) ?? [])])];
          try {
            await enrollmentService.createInTransaction(tx, {
              childId,
              branchId,
              academicYearId: target.id,
              startDate: new Date(input.billing.startDate),
              feeIds,
            });
          } catch (err) {
            throw new AcademicYearServiceError(
              `${child?.firstName} ${child?.lastName}: ${err instanceof Error ? err.message : 'not billed'}`,
              err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 400,
            );
          }
          childrenBilled++;
        }

        return {
          feesUpdated,
          calendarCopied,
          classesCreated: copies.size,
          childrenPlaced,
          childrenBilled,
        };
      },
      // Every child's billing is generated here: far more writes than a usual request.
      { maxWait: 10_000, timeout: 240_000 },
    );
  }
}

export const yearRolloverService = new YearRolloverService();
