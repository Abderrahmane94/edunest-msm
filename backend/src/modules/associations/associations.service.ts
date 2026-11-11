import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { schoolIsOpen } from '../../lib/demo';
import { linkedPassword } from '../../lib/linked-accounts';
import { cutSessions } from '../../lib/session-cutoff';
import { tenantStorage } from '../../middleware/tenancy.middleware';
import { dashboardService, schoolToday } from '../admin/dashboard.service';
import { temporaryPassword } from '../users/users.service';
import {
  attendanceRate,
  monthsEnding,
  pointsOf,
  sumPoints,
  totalsOf,
  type AssociationOverview,
  type AssociationTrend,
  type AssociationView,
  type ClubFigures,
  type MonthPoint,
} from './associations.figures';

/** What a client may call its group, and its nurseries, on its own screens. */
export const GROUP_TERMS = ['group', 'association', 'network', 'federation'] as const;
export const MEMBER_TERMS = ['nursery', 'club', 'establishment', 'daycare'] as const;
export type GroupTerm = (typeof GROUP_TERMS)[number];
export type MemberTerm = (typeof MEMBER_TERMS)[number];

export interface AssociationInput {
  name: string;
  groupTerm?: GroupTerm;
  memberTerm?: MemberTerm;
}

/** A group as its officer sees it: its name and its own words. */
const ASSOCIATION_FIELDS = { id: true, name: true, groupTerm: true, memberTerm: true } as const;

/** How many months the evolution covers, at most. */
export const TREND_MONTHS = 12;

const BCRYPT_ROUNDS = 10;

export class AssociationServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssociationServiceError';
  }
}

export interface OfficerInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  preferredLanguage?: 'fr' | 'ar';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** First day of the month and of the next one, as dates (UTC midnights, like @db.Date). */
function monthBounds(month: string): { start: Date; end: Date } {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

/** The clubs of an association (real schools: demonstrations never belong to one). */
const clubsOf = (associationId: string) =>
  prisma.school.findMany({
    where: { associationId, demoExpiresAt: null },
    select: { id: true, name: true, wilaya: true, isActive: true, demoExpiresAt: true, trialEndsAt: true },
    orderBy: { name: 'asc' },
  });

type Club = Awaited<ReturnType<typeof clubsOf>>[number];

/**
 * One club's figures. Run inside the club's tenant context, so every query is
 * held to that club whatever it asks; only numbers leave this function.
 */
async function figuresOf(club: Club, month: string): Promise<ClubFigures> {
  const schoolId = club.id;
  const { start, end } = monthBounds(month);
  const activeChild = { isActive: true, deletedAt: null };

  const [dashboard, newInMonth, staffByRole, marks, collected, expenses, salaries] = await Promise.all([
    // Today's roll call, the children, the classes and the late payments, as the director sees them.
    dashboardService.getAdminDashboard(schoolId),
    prisma.child.count({ where: { schoolId, ...activeChild, enrollmentDate: { gte: start, lt: end } } }),
    prisma.user.groupBy({
      by: ['role'],
      where: { schoolId, deletedAt: null, isActive: true, role: { in: ['admin', 'administrative', 'teacher', 'staff'] } },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { schoolId, date: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    // Corrections are stored with a negative amount: the sum is what was really kept.
    prisma.paymentRecord.aggregate({ where: { branch: { schoolId }, valueDate: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
    prisma.expense.aggregate({ where: { schoolId, date: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.salaryPayment.aggregate({ where: { schoolId, deletedAt: null, paidAt: { gte: start, lt: end } }, _sum: { netSalary: true } }),
  ]);

  const staffCount = (...roles: string[]) =>
    staffByRole.filter((r) => roles.includes(r.role)).reduce((total, r) => total + r._count._all, 0);
  const marksTotal = marks.reduce((total, m) => total + m._count._all, 0);
  const attended = marks.filter((m) => m.status !== 'absent').reduce((total, m) => total + m._count._all, 0);
  const collectedTotal = round2(collected._sum.totalAmount?.toNumber() ?? 0);
  const expensesTotal = round2(expenses._sum.amount?.toNumber() ?? 0);
  const salariesTotal = round2(salaries._sum.netSalary?.toNumber() ?? 0);
  const { attendance, enrollment, finance } = dashboard;

  return {
    id: club.id,
    name: club.name,
    wilaya: club.wilaya,
    isOpen: schoolIsOpen(club),
    children: { active: enrollment.activeChildren, newInMonth },
    staff: {
      teachers: staffCount('teacher'),
      office: staffCount('admin', 'administrative'),
      other: staffCount('staff'),
      total: staffCount('admin', 'administrative', 'teacher', 'staff'),
    },
    classrooms: {
      count: enrollment.classrooms.length,
      capacity: enrollment.classrooms.reduce((total, c) => total + c.capacity, 0),
      enrolled: enrollment.classrooms.reduce((total, c) => total + c.enrolled, 0),
    },
    attendance: {
      today: {
        isSchoolDay: attendance.isSchoolDay,
        expected: attendance.expected,
        present: attendance.present,
        late: attendance.late,
        absent: attendance.absent,
      },
      month: { rate: attendanceRate(attended, marksTotal), marks: marksTotal, attended },
    },
    finance: {
      collected: collectedTotal,
      expenses: expensesTotal,
      salaries: salariesTotal,
      net: round2(collectedTotal - expensesTotal - salariesTotal),
      late: finance.late,
      recoveryRate: finance.recoveryRate,
    },
  };
}

/** One club's months, read in its tenant context: amounts and counts only. */
async function pointsOfClub(club: Club, months: string[]): Promise<MonthPoint[]> {
  const schoolId = club.id;
  const start = monthBounds(months[0]).start;
  const end = monthBounds(months[months.length - 1]).end;
  const [payments, expenses, salaries, children, marks] = await Promise.all([
    prisma.paymentRecord.findMany({ where: { branch: { schoolId }, valueDate: { gte: start, lt: end } }, select: { valueDate: true, totalAmount: true } }),
    prisma.expense.findMany({ where: { schoolId, date: { gte: start, lt: end } }, select: { date: true, amount: true } }),
    prisma.salaryPayment.findMany({ where: { schoolId, deletedAt: null, paidAt: { gte: start, lt: end } }, select: { paidAt: true, netSalary: true } }),
    prisma.child.findMany({ where: { schoolId, isActive: true, deletedAt: null, enrollmentDate: { gte: start, lt: end } }, select: { enrollmentDate: true } }),
    prisma.attendanceRecord.groupBy({ by: ['date', 'status'], where: { schoolId, date: { gte: start, lt: end } }, _count: { _all: true } }),
  ]);
  return pointsOf(months, {
    payments: payments.map((r) => ({ date: r.valueDate, amount: r.totalAmount.toNumber() })),
    expenses: expenses.map((r) => ({ date: r.date, amount: r.amount.toNumber() })),
    salaries: salaries.map((r) => ({ date: r.paidAt, amount: r.netSalary.toNumber() })),
    children: children.map((r) => ({ date: r.enrollmentDate })),
    marks: marks.map((r) => ({ date: r.date, status: r.status, count: r._count._all })),
  });
}

/** The officer's association; refused when the account has none (or isn't an officer). */
async function officerAssociation(userId: string): Promise<AssociationView> {
  const officer = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, association: { select: ASSOCIATION_FIELDS } },
  });
  if (!officer || officer.role !== 'association' || !officer.association) {
    throw new AssociationServiceError('No association for this account', 403);
  }
  return officer.association;
}

export const associationsService = {
  // ─── The officer's own view ───

  async mine(userId: string): Promise<{ association: AssociationView; clubs: { id: string; name: string; wilaya: string }[] }> {
    const association = await officerAssociation(userId);
    const clubs = await clubsOf(association.id);
    return { association, clubs: clubs.map(({ id, name, wilaya }) => ({ id, name, wilaya })) };
  },

  /** Every club's figures for the month (YYYY-MM, not after this one), and the total. */
  async overview(userId: string, month?: string): Promise<AssociationOverview> {
    const association = await officerAssociation(userId);
    const today = schoolToday();
    const thisMonth = today.slice(0, 7);
    const chosen = month ?? thisMonth;
    if (chosen > thisMonth) throw new AssociationServiceError('This month has not started yet', 400);

    const clubs = await clubsOf(association.id);
    // One club at a time: each within its own tenant context.
    const figures: ClubFigures[] = [];
    for (const club of clubs) {
      figures.push(await tenantStorage.run({ schoolId: club.id }, () => figuresOf(club, chosen)));
    }
    return { association, month: chosen, today, totals: totalsOf(figures), clubs: figures };
  },

  /** The months up to `until` (YYYY-MM, this month by default): each club's and the total. */
  async trend(userId: string, until?: string): Promise<AssociationTrend> {
    const association = await officerAssociation(userId);
    const thisMonth = schoolToday().slice(0, 7);
    const last = until ?? thisMonth;
    if (last > thisMonth) throw new AssociationServiceError('This month has not started yet', 400);
    const months = monthsEnding(last, TREND_MONTHS);

    const clubs = await clubsOf(association.id);
    const perClub: { id: string; name: string; points: MonthPoint[] }[] = [];
    for (const club of clubs) {
      const points = await tenantStorage.run({ schoolId: club.id }, () => pointsOfClub(club, months));
      perClub.push({ id: club.id, name: club.name, points });
    }
    return { months, totals: sumPoints(months, perClub.map((c) => c.points)), clubs: perClub };
  },

  // ─── The platform (super_admin) ───

  async list() {
    const associations = await prisma.association.findMany({
      orderBy: { name: 'asc' },
      select: {
        ...ASSOCIATION_FIELDS,
        createdAt: true,
        schools: { where: { demoExpiresAt: null }, select: { id: true, name: true, wilaya: true }, orderBy: { name: 'asc' } },
        users: {
          where: { role: 'association' },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, lastActiveAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return associations.map(({ schools, users, ...a }) => ({ ...a, clubs: schools, officers: users }));
  },

  async create(input: AssociationInput) {
    return prisma.association.create({ data: input, select: { ...ASSOCIATION_FIELDS, createdAt: true } });
  },

  /** Its name, or the words its client uses. */
  async update(id: string, input: Partial<AssociationInput>) {
    await this.ensureExists(id);
    return prisma.association.update({ where: { id }, data: input, select: { ...ASSOCIATION_FIELDS, createdAt: true } });
  },

  /** Only an empty association goes: its clubs and officers are taken off first. */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    const [clubs, officers] = await Promise.all([
      prisma.school.count({ where: { associationId: id } }),
      prisma.user.count({ where: { associationId: id, role: 'association' } }),
    ]);
    if (clubs > 0 || officers > 0) {
      throw new AssociationServiceError('Take its clubs and officers off the association first', 409);
    }
    await prisma.association.delete({ where: { id } });
  },

  async ensureExists(id: string): Promise<void> {
    const association = await prisma.association.findUnique({ where: { id }, select: { id: true } });
    if (!association) throw new AssociationServiceError('Association not found', 404);
  },

  /** A club joins the association. One association at a time: it leaves the other one first. */
  async addClub(id: string, schoolId: string): Promise<void> {
    await this.ensureExists(id);
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { associationId: true, demoExpiresAt: true } });
    if (!school || school.demoExpiresAt) throw new AssociationServiceError('School not found', 404);
    if (school.associationId === id) return;
    if (school.associationId) throw new AssociationServiceError('This school already belongs to another association', 409);
    await prisma.school.update({ where: { id: schoolId }, data: { associationId: id } });
  },

  async removeClub(id: string, schoolId: string): Promise<void> {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { associationId: true } });
    if (!school || school.associationId !== id) throw new AssociationServiceError('This school is not in the association', 404);
    await prisma.school.update({ where: { id: schoolId }, data: { associationId: null } });
  },

  /**
   * An officer's account: their first password, told once to the platform —
   * or, when the person already has an account, their own password.
   */
  async addOfficer(id: string, input: OfficerInput) {
    await this.ensureExists(id);
    if (input.email) {
      const taken = await prisma.user.count({
        where: { associationId: id, role: 'association', email: { equals: input.email, mode: 'insensitive' } },
      });
      if (taken > 0) throw new AssociationServiceError('This association already has an officer with this email', 409);
    }
    const linked = await linkedPassword({ email: input.email ?? null, phone: input.phone ?? null });
    const password = linked ? null : temporaryPassword();
    const passwordHash = linked ? linked.passwordHash : await bcrypt.hash(password!, BCRYPT_ROUNDS);

    const officer = await prisma.user.create({
      data: {
        schoolId: null,
        associationId: id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        passwordHash,
        role: 'association',
        preferredLanguage: input.preferredLanguage ?? 'fr',
        isActive: true,
        mustChangePassword: linked ? linked.mustChangePassword : true,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    return { ...officer, temporaryPassword: password, linkedAccount: linked !== null };
  },

  /** The officer's account is closed, and the sessions it had open with it. */
  async removeOfficer(id: string, userId: string): Promise<void> {
    const officer = await prisma.user.findUnique({ where: { id: userId }, select: { associationId: true, role: true } });
    if (!officer || officer.role !== 'association' || officer.associationId !== id) {
      throw new AssociationServiceError('Officer not found', 404);
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { isActive: false, deletedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    cutSessions(userId);
  },
};
