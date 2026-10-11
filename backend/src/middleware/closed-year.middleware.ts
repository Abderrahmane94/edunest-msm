import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { academicYearsService } from '../modules/academic-years/academic-years.service';
import { errorResponse } from '../utils/response';

export const CLOSED_YEAR_MESSAGE = 'This school year is closed: only its unpaid charges can be collected';

type YearIds = string | null | undefined | Array<string | null | undefined>;

/**
 * Refuses a change to a closed school year (one before the current year):
 * past years can be looked at and their unpaid charges collected, nothing
 * else. `yearOf` finds the year(s) the request writes to.
 */
export function rejectClosedYear(yearOf: (req: Request) => Promise<YearIds> | YearIds) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) return next();
      const found = await yearOf(req);
      const ids = (Array.isArray(found) ? found : [found]).filter((id): id is string => !!id);
      for (const id of new Set(ids)) {
        if (await academicYearsService.isClosed(schoolId, id)) {
          res.status(409).json(errorResponse('YEAR_CLOSED', CLOSED_YEAR_MESSAGE));
          return;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Where each kind of record finds its school year. */
export const yearOf = {
  body: (field = 'academicYearId') => (req: Request) => str((req.body as Record<string, unknown>)?.[field]),
  classroom: async (id: unknown) =>
    str(id)
      ? (await prisma.classroom.findFirst({ where: { id: str(id) }, select: { academicYearId: true } }))?.academicYearId
      : undefined,
  enrollment: async (id: unknown) =>
    str(id)
      ? (await prisma.enrollment.findFirst({ where: { id: str(id) }, select: { academicYearId: true } }))?.academicYearId
      : undefined,
  discount: async (id: unknown) =>
    str(id)
      ? (await prisma.discount.findFirst({ where: { id: str(id) }, select: { enrollment: { select: { academicYearId: true } } } }))
          ?.enrollment.academicYearId
      : undefined,
  calendar: async (id: unknown) =>
    str(id)
      ? (await prisma.branchCalendar.findFirst({ where: { id: str(id) }, select: { academicYearId: true } }))?.academicYearId
      : undefined,
  expense: async (id: unknown) =>
    str(id)
      ? (await prisma.expense.findFirst({ where: { id: str(id) }, select: { academicYearId: true } }))?.academicYearId
      : undefined,
  salaryPayment: async (id: unknown) =>
    str(id)
      ? (await prisma.salaryPayment.findFirst({ where: { id: str(id) }, select: { academicYearId: true } }))?.academicYearId
      : undefined,
  attendance: async (id: unknown) =>
    str(id)
      ? (await prisma.attendanceRecord.findFirst({ where: { id: str(id) }, select: { classroom: { select: { academicYearId: true } } } }))
          ?.classroom.academicYearId
      : undefined,
  substitution: async (id: unknown) =>
    str(id)
      ? (await prisma.substitution.findFirst({ where: { id: str(id) }, select: { classroom: { select: { academicYearId: true } } } }))
          ?.classroom.academicYearId
      : undefined,
  /** The year a day counts in (same rule as everywhere: yearForDate). */
  date: async (req: Request, day: unknown) => {
    const d = str(day) ? new Date(str(day)!) : null;
    return d && !Number.isNaN(d.getTime()) ? academicYearsService.yearForDate(req.user!.schoolId!, d) : undefined;
  },
};
