import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type { SetSalaryInput, RecordPaymentInput } from './payroll.schema';

export class PayrollError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PayrollError';
  }
}

export interface StudentDaysResult {
  basis: 'working_day' | 'present_day';
  classes: {
    id: string;
    name: string;
    students: number;
    workingDays: number;
    studentWorkingDays: number;
    presentDays: number;
  }[];
  totals: { students: number; studentWorkingDays: number; presentDays: number };
  /** Student-days the salary is computed on, per the salary's basis. */
  units: number;
}

export const payrollService = {
  async listEmployees(schoolId: string) {
    const users = await prisma.user.findMany({
      where: {
        schoolId,
        role: { in: ['admin', 'teacher'] },
        deletedAt: null,
        isActive: true,
      },
      include: {
        employeeSalary: true,
        salaryPayments: {
          where: { deletedAt: null, schoolId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      salary: u.employeeSalary
        ? {
            salaryType: u.employeeSalary.salaryType as 'fixed' | 'per_student',
            baseSalary: u.employeeSalary.baseSalary?.toFixed(2) ?? null,
            ratePerStudent: u.employeeSalary.ratePerStudent?.toFixed(2) ?? null,
            perStudentBasis: u.employeeSalary.perStudentBasis as 'working_day' | 'present_day',
            currency: u.employeeSalary.currency,
            effectiveFrom: u.employeeSalary.effectiveFrom,
            notes: u.employeeSalary.notes,
          }
        : null,
      lastPayment: u.salaryPayments[0]
        ? {
            month: u.salaryPayments[0].month,
            year: u.salaryPayments[0].year,
            netSalary: u.salaryPayments[0].netSalary.toFixed(2),
            paidAt: u.salaryPayments[0].paidAt,
          }
        : null,
    }));
  },

  async setSalary(schoolId: string, userId: string, data: SetSalaryInput) {
    const user = await prisma.user.findFirst({
      where: { id: userId, schoolId, deletedAt: null },
    });
    if (!user) throw new PayrollError('Employee not found', 404);
    if (!['admin', 'teacher'].includes(user.role)) {
      throw new PayrollError('User is not a staff member');
    }

    const salaryFields = {
      salaryType: data.salaryType,
      baseSalary: data.salaryType === 'fixed' ? new Prisma.Decimal(data.baseSalary!) : null,
      ratePerStudent:
        data.salaryType === 'per_student' ? new Prisma.Decimal(data.ratePerStudent!) : null,
      perStudentBasis: data.perStudentBasis,
      currency: data.currency,
      effectiveFrom: new Date(data.effectiveFrom),
      notes: data.notes,
    };

    const salary = await prisma.employeeSalary.upsert({
      where: { userId },
      create: { userId, schoolId, ...salaryFields },
      update: salaryFields,
    });

    return {
      salaryType: salary.salaryType as 'fixed' | 'per_student',
      baseSalary: salary.baseSalary?.toFixed(2) ?? null,
      ratePerStudent: salary.ratePerStudent?.toFixed(2) ?? null,
      perStudentBasis: salary.perStudentBasis as 'working_day' | 'present_day',
      currency: salary.currency,
      effectiveFrom: salary.effectiveFrom,
      notes: salary.notes,
    };
  },

  async listPayments(
    schoolId: string,
    filters: {
      userId?: string;
      year?: number;
      month?: number;
      role?: 'admin' | 'teacher';
      /** Paid on or after this date (YYYY-MM-DD). */
      paidFrom?: string;
      /** Paid on or before this date (YYYY-MM-DD). */
      paidTo?: string;
      page: number;
      pageSize: number;
    },
  ) {
    const where: Prisma.SalaryPaymentWhereInput = {
      schoolId,
      deletedAt: null,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.month ? { month: filters.month } : {}),
      ...(filters.role ? { user: { role: filters.role } } : {}),
      ...(filters.paidFrom || filters.paidTo
        ? {
            paidAt: {
              ...(filters.paidFrom ? { gte: new Date(filters.paidFrom) } : {}),
              ...(filters.paidTo ? { lte: new Date(filters.paidTo) } : {}),
            },
          }
        : {}),
    };

    const [items, total, sum] = await Promise.all([
      prisma.salaryPayment.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.salaryPayment.count({ where }),
      prisma.salaryPayment.aggregate({ where, _sum: { netSalary: true } }),
    ]);

    return {
      // Net paid over every matching payment, not just this page.
      totalNet: sum._sum.netSalary?.toFixed(2) ?? '0.00',
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        employeeName: `${p.user.firstName} ${p.user.lastName}`,
        role: p.user.role,
        month: p.month,
        year: p.year,
        baseSalary: p.baseSalary.toFixed(2),
        bonuses: p.bonuses.toFixed(2),
        deductions: p.deductions.toFixed(2),
        netSalary: p.netSalary.toFixed(2),
        studentCount: p.studentCount,
        studentDays: p.studentDays,
        paidAt: p.paidAt,
        note: p.note,
        createdAt: p.createdAt,
      })),
      total,
    };
  },

  /**
   * Student-days for a per-student salary in a given month, per class the
   * teacher has in that month's academic year:
   * - working: each child counts every working day of the class (its week days)
   *   from the day they joined the class;
   * - present: attendance marked present or late.
   * `units` is the one matching the salary's basis.
   */
  async studentDays(
    schoolId: string,
    userId: string,
    year: number,
    month: number,
  ): Promise<StudentDaysResult> {
    const salary = await prisma.employeeSalary.findFirst({ where: { userId, schoolId } });
    const basis = (salary?.perStudentBasis ?? 'working_day') as 'working_day' | 'present_day';

    // @db.Date columns are UTC midnights.
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const classrooms = await prisma.classroom.findMany({
      where: {
        schoolId,
        teacherUserId: userId,
        deletedAt: null,
        academicYear: { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
      },
      select: {
        id: true,
        name: true,
        workingDays: true,
        enrollments: { select: { enrolledAt: true } },
      },
      orderBy: { name: 'asc' },
    });

    const presence = classrooms.length
      ? await prisma.attendanceRecord.groupBy({
          by: ['classroomId'],
          where: {
            classroomId: { in: classrooms.map((c) => c.id) },
            date: { gte: monthStart, lte: monthEnd },
            status: { in: ['present', 'late'] },
          },
          _count: { _all: true },
        })
      : [];
    const presentByClass = new Map(presence.map((p) => [p.classroomId, p._count._all]));

    const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const classes = classrooms.map((c) => {
      const days = new Set(Array.isArray(c.workingDays) ? (c.workingDays as string[]) : []);
      // The class's working dates this month.
      const dates: number[] = [];
      for (let d = new Date(monthStart); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
        if (days.has(WEEKDAYS[d.getUTCDay()])) dates.push(d.getTime());
      }
      // Each child counts from the day they joined the class.
      const studentWorkingDays = c.enrollments.reduce((sum, e) => {
        const joined = new Date(e.enrolledAt);
        const from = Date.UTC(joined.getUTCFullYear(), joined.getUTCMonth(), joined.getUTCDate());
        return sum + dates.filter((t) => t >= from).length;
      }, 0);
      return {
        id: c.id,
        name: c.name,
        students: c.enrollments.length,
        workingDays: dates.length,
        studentWorkingDays,
        presentDays: presentByClass.get(c.id) ?? 0,
      };
    });

    const totals = {
      students: classes.reduce((s, c) => s + c.students, 0),
      studentWorkingDays: classes.reduce((s, c) => s + c.studentWorkingDays, 0),
      presentDays: classes.reduce((s, c) => s + c.presentDays, 0),
    };
    return {
      basis,
      classes,
      totals,
      units: basis === 'present_day' ? totals.presentDays : totals.studentWorkingDays,
    };
  },

  async recordPayment(schoolId: string, data: RecordPaymentInput) {
    const user = await prisma.user.findFirst({
      where: { id: data.userId, schoolId, deletedAt: null },
      include: { employeeSalary: true },
    });
    if (!user) throw new PayrollError('Employee not found', 404);

    // If a salary configuration exists, the submitted baseSalary must match it —
    // otherwise an admin (or a buggy client) could bypass the configured rate entirely.
    const EPSILON = 0.01;
    if (user.employeeSalary) {
      if (user.employeeSalary.salaryType === 'fixed') {
        const expected = Number(user.employeeSalary.baseSalary);
        if (Math.abs(data.baseSalary - expected) > EPSILON) {
          throw new PayrollError(
            `baseSalary must match the configured fixed salary (${expected.toFixed(2)})`,
          );
        }
      } else {
        // Rate per student per day: the base is rate × student-days.
        const rate = Number(user.employeeSalary.ratePerStudent);
        const days = data.studentDays ?? 0;
        const expected = Math.round(rate * days * 100) / 100;
        if (Math.abs(data.baseSalary - expected) > EPSILON) {
          throw new PayrollError(
            `baseSalary must match the configured per-student rate (${rate.toFixed(2)} x ${days} student-days = ${expected.toFixed(2)})`,
          );
        }
      }
    }

    const net = data.baseSalary + data.bonuses - data.deductions;
    if (net < 0) {
      throw new PayrollError('Net salary cannot be negative — deductions exceed base salary plus bonuses');
    }

    let payment;
    try {
      payment = await prisma.$transaction(async (tx) => {
        const existing = await tx.salaryPayment.findFirst({
          where: { userId: data.userId, month: data.month, year: data.year, deletedAt: null },
        });
        if (existing) {
          throw new PayrollError(
            `Payment for ${data.month}/${data.year} already exists for this employee`,
          );
        }

        return tx.salaryPayment.create({
          data: {
            userId: data.userId,
            schoolId,
            month: data.month,
            year: data.year,
            baseSalary: new Prisma.Decimal(data.baseSalary),
            bonuses: new Prisma.Decimal(data.bonuses),
            deductions: new Prisma.Decimal(data.deductions),
            netSalary: new Prisma.Decimal(net),
            studentCount: data.studentCount ?? null,
            studentDays: data.studentDays ?? null,
            paidAt: new Date(data.paidAt),
            note: data.note,
          },
          include: { user: { select: { firstName: true, lastName: true, role: true } } },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new PayrollError(
          `Payment for ${data.month}/${data.year} already exists for this employee`,
        );
      }
      throw error;
    }

    return {
      id: payment.id,
      userId: payment.userId,
      employeeName: `${payment.user.firstName} ${payment.user.lastName}`,
      role: payment.user.role,
      month: payment.month,
      year: payment.year,
      baseSalary: payment.baseSalary.toFixed(2),
      bonuses: payment.bonuses.toFixed(2),
      deductions: payment.deductions.toFixed(2),
      netSalary: payment.netSalary.toFixed(2),
      studentCount: payment.studentCount,
      studentDays: payment.studentDays,
      paidAt: payment.paidAt,
      note: payment.note,
      createdAt: payment.createdAt,
    };
  },

  async deletePayment(schoolId: string, paymentId: string) {
    const payment = await prisma.salaryPayment.findFirst({
      where: { id: paymentId, schoolId, deletedAt: null },
    });
    if (!payment) throw new PayrollError('Payment not found', 404);

    await prisma.salaryPayment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date() },
    });
  },
};
