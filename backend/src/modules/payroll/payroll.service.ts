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
      currency: salary.currency,
      effectiveFrom: salary.effectiveFrom,
      notes: salary.notes,
    };
  },

  async listPayments(
    schoolId: string,
    filters: { userId?: string; year?: number; month?: number; page: number; pageSize: number },
  ) {
    const where: Prisma.SalaryPaymentWhereInput = {
      schoolId,
      deletedAt: null,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.month ? { month: filters.month } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.salaryPayment.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.salaryPayment.count({ where }),
    ]);

    return {
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
        paidAt: p.paidAt,
        note: p.note,
        createdAt: p.createdAt,
      })),
      total,
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
        const rate = Number(user.employeeSalary.ratePerStudent);
        const expected = Math.round(rate * (data.studentCount ?? 0) * 100) / 100;
        if (Math.abs(data.baseSalary - expected) > EPSILON) {
          throw new PayrollError(
            `baseSalary must match the configured per-student rate (${rate.toFixed(2)} x ${data.studentCount ?? 0} students = ${expected.toFixed(2)})`,
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
