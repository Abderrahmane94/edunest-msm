import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), groupBy: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    school: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    association: { findUnique: vi.fn(), delete: vi.fn() },
    child: { count: vi.fn(), findMany: vi.fn() },
    attendanceRecord: { groupBy: vi.fn() },
    paymentRecord: { aggregate: vi.fn(), findMany: vi.fn() },
    expense: { aggregate: vi.fn(), findMany: vi.fn() },
    salaryPayment: { aggregate: vi.fn(), findMany: vi.fn() },
    refreshToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../admin/dashboard.service', () => ({
  schoolToday: () => '2026-11-10',
  dashboardService: { getAdminDashboard: vi.fn() },
}));
vi.mock('../../lib/session-cutoff', () => ({ cutSessions: vi.fn() }));

import prisma from '../../lib/prisma';
import { dashboardService } from '../admin/dashboard.service';
import { getCurrentSchoolId } from '../../middleware/tenancy.middleware';
import { cutSessions } from '../../lib/session-cutoff';
import { associationsService } from './associations.service';
import { monthsEnding, pointsOf, totalsOf } from './associations.figures';

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>> & { $transaction: ReturnType<typeof vi.fn> };
const getDashboard = dashboardService.getAdminDashboard as unknown as ReturnType<typeof vi.fn>;
const dec = (n: number) => new Prisma.Decimal(n);

const officer = { role: 'association', association: { id: 'asso-1', name: 'Association Les Petits' } };
const clubA = { id: 'school-A', name: 'Club A', wilaya: 'Alger', isActive: true, demoExpiresAt: null, trialEndsAt: null };
const clubB = { id: 'school-B', name: 'Club B', wilaya: 'Blida', isActive: true, demoExpiresAt: null, trialEndsAt: null };

/** What the director's dashboard returns, with the names the association must never see. */
function dashboardOf(schoolId: string) {
  const a = schoolId === 'school-A';
  return {
    attendance: {
      isSchoolDay: true, expected: a ? 20 : 10, present: a ? 15 : 8, late: a ? 2 : 0, absent: a ? 3 : 2,
      missingClassrooms: [{ id: 'c9', name: 'Les Lutins', teacherName: 'Samia Benali', childCount: 4 }],
      classroomsToday: 2, weeks: [],
    },
    enrollment: {
      activeChildren: a ? 25 : 12, newThisMonth: 0,
      classrooms: [{ id: 'c1', name: 'Les Lutins', capacity: 15, enrolled: a ? 13 : 6 }, { id: 'c2', name: 'Les Fées', capacity: 15, enrolled: a ? 12 : 6 }],
    },
    finance: { late: { amount: a ? 9000 : 3000, children: a ? 3 : 1 }, recoveryRate: a ? 90 : 75 },
    communication: { upcomingEvents: [{ id: 'e1', title: 'Sortie au zoo', startDatetime: '', location: null }] },
  };
}

describe('associations — an officer sees each club’s figures and the total, nothing else', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue(officer);
    db.school.findMany.mockResolvedValue([clubA, clubB]);
    getDashboard.mockImplementation(async (schoolId: string) => dashboardOf(schoolId));
    db.child.count.mockImplementation(async () => (getCurrentSchoolId() === 'school-A' ? 2 : 1));
    db.user.groupBy.mockImplementation(async () =>
      getCurrentSchoolId() === 'school-A'
        ? [{ role: 'admin', _count: { _all: 1 } }, { role: 'teacher', _count: { _all: 3 } }, { role: 'staff', _count: { _all: 2 } }]
        : [{ role: 'admin', _count: { _all: 1 } }, { role: 'teacher', _count: { _all: 1 } }],
    );
    db.attendanceRecord.groupBy.mockImplementation(async () =>
      getCurrentSchoolId() === 'school-A'
        ? [{ status: 'present', _count: { _all: 80 } }, { status: 'late', _count: { _all: 10 } }, { status: 'absent', _count: { _all: 10 } }]
        : [{ status: 'present', _count: { _all: 30 } }, { status: 'absent', _count: { _all: 20 } }],
    );
    db.paymentRecord.aggregate.mockImplementation(async () => ({ _sum: { totalAmount: dec(getCurrentSchoolId() === 'school-A' ? 100000 : 40000) } }));
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: dec(10000) } });
    db.salaryPayment.aggregate.mockResolvedValue({ _sum: { netSalary: null } });
  });

  it('computes each club within that club’s tenant context', async () => {
    const seen: (string | undefined)[] = [];
    getDashboard.mockImplementation(async (schoolId: string) => {
      seen.push(getCurrentSchoolId());
      return dashboardOf(schoolId);
    });
    await associationsService.overview('o1', '2026-11');
    expect(seen).toEqual(['school-A', 'school-B']);
    expect(db.school.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { associationId: 'asso-1', demoExpiresAt: null } }));
  });

  it('gives each club’s counts and money, and the total', async () => {
    const overview = await associationsService.overview('o1', '2026-11');
    const [a, b] = overview.clubs;
    expect(a).toMatchObject({
      name: 'Club A', isOpen: true,
      children: { active: 25, newInMonth: 2 },
      staff: { teachers: 3, office: 1, other: 2, total: 6 },
      classrooms: { count: 2, capacity: 30, enrolled: 25 },
      attendance: { today: { expected: 20, present: 15, late: 2, absent: 3 }, month: { rate: 90, marks: 100, attended: 90 } },
      finance: { collected: 100000, expenses: 10000, salaries: 0, net: 90000, late: { amount: 9000, children: 3 }, recoveryRate: 90 },
    });
    expect(b.attendance.month).toEqual({ rate: 60, marks: 50, attended: 30 });
    expect(overview.totals).toMatchObject({
      clubs: 2,
      children: { active: 37, newInMonth: 3 },
      staff: { teachers: 4, total: 8 },
      // Over all the marks (120 of 150), not the average of the two rates.
      attendance: { month: { rate: 80, marks: 150, attended: 120 } },
      finance: { collected: 140000, net: 120000, late: { amount: 12000, children: 4 } },
    });
  });

  it('lets no name out: no child, teacher, class or event', async () => {
    const json = JSON.stringify(await associationsService.overview('o1'));
    for (const name of ['Samia', 'Lutins', 'Fées', 'zoo', 'teacherName', 'missingClassrooms']) expect(json).not.toContain(name);
  });

  it('covers the current month by default, and refuses a month to come', async () => {
    expect((await associationsService.overview('o1')).month).toBe('2026-11');
    await expect(associationsService.overview('o1', '2026-12')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses an account that is not an officer of an association', async () => {
    db.user.findUnique.mockResolvedValue({ role: 'admin', association: null });
    await expect(associationsService.overview('u1')).rejects.toMatchObject({ statusCode: 403 });
    db.user.findUnique.mockResolvedValue({ role: 'association', association: null });
    await expect(associationsService.mine('o1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('associations — the platform links the clubs and the officers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.association.findUnique.mockResolvedValue({ id: 'asso-1' });
  });

  it('adds a school as a club, but not one in another association, nor a demonstration', async () => {
    db.school.findUnique.mockResolvedValue({ associationId: null, demoExpiresAt: null });
    await associationsService.addClub('asso-1', 'school-A');
    expect(db.school.update).toHaveBeenCalledWith({ where: { id: 'school-A' }, data: { associationId: 'asso-1' } });

    db.school.findUnique.mockResolvedValue({ associationId: 'asso-2', demoExpiresAt: null });
    await expect(associationsService.addClub('asso-1', 'school-A')).rejects.toMatchObject({ statusCode: 409 });

    db.school.findUnique.mockResolvedValue({ associationId: null, demoExpiresAt: new Date() });
    await expect(associationsService.addClub('asso-1', 'school-A')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('only takes off a club that is in this association', async () => {
    db.school.findUnique.mockResolvedValue({ associationId: 'asso-2' });
    await expect(associationsService.removeClub('asso-1', 'school-A')).rejects.toMatchObject({ statusCode: 404 });
    expect(db.school.update).not.toHaveBeenCalled();
  });

  it('closes an officer’s account and its sessions, only for an officer of this association', async () => {
    db.user.findUnique.mockResolvedValue({ associationId: 'asso-2', role: 'association' });
    await expect(associationsService.removeOfficer('asso-1', 'o1')).rejects.toMatchObject({ statusCode: 404 });

    db.user.findUnique.mockResolvedValue({ associationId: 'asso-1', role: 'admin' });
    await expect(associationsService.removeOfficer('asso-1', 'u1')).rejects.toMatchObject({ statusCode: 404 });

    db.user.findUnique.mockResolvedValue({ associationId: 'asso-1', role: 'association' });
    await associationsService.removeOfficer('asso-1', 'o1');
    expect(db.$transaction).toHaveBeenCalled();
    expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'o1' } });
    expect(cutSessions).toHaveBeenCalledWith('o1');
  });

  it('removes only an empty association', async () => {
    db.school.count.mockResolvedValue(1);
    db.user.count.mockResolvedValue(0);
    await expect(associationsService.remove('asso-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(db.association.delete).not.toHaveBeenCalled();
  });
});

describe('totalsOf', () => {
  it('has no rate without marks, and nothing for an association without clubs', () => {
    const totals = totalsOf([]);
    expect(totals.clubs).toBe(0);
    expect(totals.attendance.month.rate).toBeNull();
    expect(totals.finance.collected).toBe(0);
  });
});

describe('associations — the evolution, month by month', () => {
  const d = (day: string) => new Date(`${day}T00:00:00.000Z`);

  it('counts twelve months back, across the new year', () => {
    expect(monthsEnding('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsEnding('2026-11', 12)).toHaveLength(12);
    expect(monthsEnding('2026-11', 12)[0]).toBe('2025-12');
  });

  it('puts each row in its month and leaves out the others', () => {
    const points = pointsOf(['2026-10', '2026-11'], {
      payments: [{ date: d('2026-10-05'), amount: 1000 }, { date: d('2026-11-02'), amount: 500 }, { date: d('2026-11-03'), amount: -100 }, { date: d('2026-09-30'), amount: 999 }],
      expenses: [{ date: d('2026-11-10'), amount: 200 }],
      salaries: [{ date: d('2026-10-31'), amount: 300 }],
      children: [{ date: d('2026-11-01') }],
      marks: [{ date: d('2026-11-02'), status: 'present', count: 8 }, { date: d('2026-11-02'), status: 'late', count: 1 }, { date: d('2026-11-02'), status: 'absent', count: 1 }],
    });
    expect(points[0]).toMatchObject({ month: '2026-10', collected: 1000, salaries: 300, net: 700, newChildren: 0, rate: null });
    expect(points[1]).toMatchObject({ month: '2026-11', collected: 400, expenses: 200, net: 200, newChildren: 1, marks: 10, attended: 9, rate: 90 });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue(officer);
    db.school.findMany.mockResolvedValue([clubA, clubB]);
    db.paymentRecord.findMany.mockImplementation(async () => [{ valueDate: d('2026-11-05'), totalAmount: dec(getCurrentSchoolId() === 'school-A' ? 1000 : 500) }]);
    db.expense.findMany.mockResolvedValue([]);
    db.salaryPayment.findMany.mockResolvedValue([{ paidAt: d('2026-10-28'), netSalary: dec(400) }]);
    db.child.findMany.mockResolvedValue([]);
    db.attendanceRecord.groupBy.mockImplementation(async () =>
      getCurrentSchoolId() === 'school-A' ? [{ date: d('2026-11-03'), status: 'present', _count: { _all: 3 } }] : [{ date: d('2026-11-03'), status: 'absent', _count: { _all: 1 } }],
    );
  });

  it('gives each club’s months and the association’s, each club read in its own context', async () => {
    const trend = await associationsService.trend('o1');
    expect(trend.months).toHaveLength(12);
    expect(trend.months[11]).toBe('2026-11');
    expect(trend.clubs.map((c) => c.name)).toEqual(['Club A', 'Club B']);
    const november = trend.totals[11];
    expect(november).toMatchObject({ collected: 1500, marks: 4, attended: 3, rate: 75 });
    expect(trend.totals[10]).toMatchObject({ month: '2026-10', salaries: 800, net: -800 });
  });

  it('refuses a month to come', async () => {
    await expect(associationsService.trend('o1', '2027-01')).rejects.toMatchObject({ statusCode: 400 });
  });
});
