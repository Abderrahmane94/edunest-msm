import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { schoolIsOpen } from '../../lib/demo';
import { linkedPassword } from '../../lib/linked-accounts';
import { cutSessions } from '../../lib/session-cutoff';
import { tenantStorage } from '../../middleware/tenancy.middleware';
import { dashboardService, schoolToday } from '../admin/dashboard.service';
import { temporaryPassword } from '../users/users.service';
import { attendanceRate, totalsOf, type AssociationOverview, type ClubFigures } from './associations.figures';

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

/** The officer's association; refused when the account has none (or isn't an officer). */
async function officerAssociation(userId: string): Promise<{ id: string; name: string }> {
  const officer = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, association: { select: { id: true, name: true } } },
  });
  if (!officer || officer.role !== 'association' || !officer.association) {
    throw new AssociationServiceError('No association for this account', 403);
  }
  return officer.association;
}

export const associationsService = {
  // ─── The officer's own view ───

  async mine(userId: string): Promise<{ association: { id: string; name: string }; clubs: { id: string; name: string; wilaya: string }[] }> {
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

  // ─── The platform (super_admin) ───

  async list() {
    const associations = await prisma.association.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
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

  async create(name: string) {
    return prisma.association.create({ data: { name }, select: { id: true, name: true, createdAt: true } });
  },

  async rename(id: string, name: string) {
    await this.ensureExists(id);
    return prisma.association.update({ where: { id }, data: { name }, select: { id: true, name: true, createdAt: true } });
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
