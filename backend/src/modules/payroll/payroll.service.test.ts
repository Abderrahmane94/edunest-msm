import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    salaryPayment: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    employeeSalary: { findFirst: vi.fn() },
    classroom: { findMany: vi.fn() },
    attendanceRecord: { groupBy: vi.fn() },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { payrollService } from './payroll.service';

const mockPrisma = prisma as unknown as {
  salaryPayment: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  employeeSalary: { findFirst: ReturnType<typeof vi.fn> };
  classroom: { findMany: ReturnType<typeof vi.fn> };
  attendanceRecord: { groupBy: ReturnType<typeof vi.fn> };
  user: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('payrollService.listPayments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.salaryPayment.findMany.mockResolvedValue([]);
    mockPrisma.salaryPayment.count.mockResolvedValue(3);
    mockPrisma.salaryPayment.aggregate.mockResolvedValue({ _sum: { netSalary: new Prisma.Decimal('75500') } });
  });

  it('filters by role and returns the net total of every matching payment', async () => {
    const result = await payrollService.listPayments('school-1', {
      year: 2026,
      role: 'teacher',
      page: 1,
      pageSize: 20,
    });

    const where = { schoolId: 'school-1', deletedAt: null, year: 2026, user: { role: 'teacher' } };
    expect(mockPrisma.salaryPayment.findMany.mock.calls[0][0].where).toEqual(where);
    expect(mockPrisma.salaryPayment.aggregate).toHaveBeenCalledWith({ where, _sum: { netSalary: true } });
    expect(result.total).toBe(3);
    expect(result.totalNet).toBe('75500.00');
  });

  it('filters by payment date range', async () => {
    await payrollService.listPayments('school-1', {
      paidFrom: '2026-09-01',
      paidTo: '2026-09-30',
      page: 1,
      pageSize: 20,
    });

    expect(mockPrisma.salaryPayment.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-1',
      deletedAt: null,
      paidAt: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
    });
  });
});

describe('payrollService.studentDays', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // October 2026: 21 Sunday–Thursday working days (the 1st is a Thursday).
    mockPrisma.classroom.findMany.mockResolvedValue([
      {
        id: 'class-a',
        name: 'Les Poussins',
        workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
        enrollments: [
          { enrolledAt: new Date('2026-09-01T08:00:00Z') }, // whole month: 21
          { enrolledAt: new Date('2026-10-15T08:00:00Z') }, // from the 15th: 11
        ],
      },
    ]);
    mockPrisma.attendanceRecord.groupBy.mockResolvedValue([{ classroomId: 'class-a', _count: { _all: 25 } }]);
  });

  it("counts students × working days from each child's arrival, by default", async () => {
    mockPrisma.employeeSalary.findFirst.mockResolvedValue({ perStudentBasis: 'working_day' });

    const result = await payrollService.studentDays('school-1', 'teacher-1', 2026, 10);

    expect(result.classes).toEqual([
      { id: 'class-a', name: 'Les Poussins', students: 2, workingDays: 21, studentWorkingDays: 32, presentDays: 25 },
    ]);
    expect(result.basis).toBe('working_day');
    expect(result.units).toBe(32);
  });

  it('uses attendance (present or late) for the present-day basis', async () => {
    mockPrisma.employeeSalary.findFirst.mockResolvedValue({ perStudentBasis: 'present_day' });

    const result = await payrollService.studentDays('school-1', 'teacher-1', 2026, 10);

    expect(result.units).toBe(25);
    expect(mockPrisma.attendanceRecord.groupBy.mock.calls[0][0].where.status).toEqual({ in: ['present', 'late'] });
  });

  it("only looks at the teacher's classes of that month's academic year", async () => {
    mockPrisma.employeeSalary.findFirst.mockResolvedValue(null);

    await payrollService.studentDays('school-1', 'teacher-1', 2026, 10);

    const where = mockPrisma.classroom.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ schoolId: 'school-1', teacherUserId: 'teacher-1', deletedAt: null });
    expect(where.academicYear).toEqual({
      startDate: { lte: new Date(Date.UTC(2026, 9, 31)) },
      endDate: { gte: new Date(Date.UTC(2026, 9, 1)) },
    });
  });
});

describe('payrollService.recordPayment — per student', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'teacher-1',
      employeeSalary: { salaryType: 'per_student', ratePerStudent: new Prisma.Decimal('250') },
    });
  });

  it('rejects a base salary that is not rate × student-days', async () => {
    await expect(
      payrollService.recordPayment('school-1', {
        userId: 'teacher-1',
        month: 10,
        year: 2026,
        baseSalary: 500, // 250 × 2 students, the old rule
        bonuses: 0,
        deductions: 0,
        studentCount: 2,
        studentDays: 32,
        paidAt: '2026-10-31',
      }),
    ).rejects.toThrow('250.00 x 32 student-days = 8000.00');
  });
});
