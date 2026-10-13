import { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';
import { accessService } from '../access/access.service';
import { allows } from '../access/permissions';

export class CashDeskServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'CASH_DESK_ERROR',
  ) {
    super(message);
    this.name = 'CashDeskServiceError';
  }
}

export interface CollectInput {
  /** What the collector found in the desk. */
  countedAmount: number;
  /** Left in the desk to give change. */
  floatLeft: number;
  /** What the screen said should be there: refused if it changed meanwhile. */
  expectedAmount: number;
  reason?: string | null;
  note?: string | null;
}

const OFFICE_ROLES = ['admin', 'administrative'] as const;
const person = { select: { id: true, firstName: true, lastName: true } };
const fullName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';
const zero = new Prisma.Decimal(0);
const money = (d: Prisma.Decimal | null | undefined) => (d ?? zero).toFixed(2);
const DAY_MS = 24 * 60 * 60 * 1000;

/** What a desk should hold: the float left last time, plus cash taken, less cash spent. */
export function expectedAmount(openingFloat: Prisma.Decimal, cashIn: Prisma.Decimal, cashOut: Prisma.Decimal): Prisma.Decimal {
  return openingFloat.add(cashIn).sub(cashOut);
}

/** Whether a desk is due for a handover: too much money in it, or money in it for too long. */
export function isDue(
  desk: { expected: Prisma.Decimal; oldestAt: Date | null },
  settings: { cashAlertAmount: Prisma.Decimal; cashAlertDays: number },
  now: Date = new Date(),
): boolean {
  if (settings.cashAlertAmount.gt(0) && desk.expected.gte(settings.cashAlertAmount)) return true;
  if (settings.cashAlertDays > 0 && desk.oldestAt && now.getTime() - desk.oldestAt.getTime() >= settings.cashAlertDays * DAY_MS) return true;
  return false;
}

class CashDesksService {
  /** The money not yet handed over in a person's desk, with its payments and expenses. */
  private async open(userId: string, db: DbClient = prisma) {
    const [last, payments, expenses] = await Promise.all([
      db.cashHandover.findFirst({ where: { cashierUserId: userId }, orderBy: { createdAt: 'desc' } }),
      db.paymentRecord.findMany({
        where: { cashierUserId: userId, cashHandoverId: null, channel: 'cash' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          receiptNumber: true,
          totalAmount: true,
          isCorrection: true,
          valueDate: true,
          createdAt: true,
          child: { select: { firstName: true, lastName: true } },
        },
      }),
      db.expense.findMany({
        where: { paidFromCashUserId: userId, cashHandoverId: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, description: true, category: true, amount: true, date: true, createdAt: true },
      }),
    ]);
    const openingFloat = last?.floatLeft ?? zero;
    const cashIn = payments.reduce((s, p) => s.add(p.totalAmount), zero);
    const cashOut = expenses.reduce((s, e) => s.add(e.amount), zero);
    const dates = [...payments.map((p) => p.createdAt), ...expenses.map((e) => e.createdAt)];
    // A float alone waits since the handover that left it.
    const oldestAt = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
    return { last, payments, expenses, openingFloat, cashIn, cashOut, expected: expectedAmount(openingFloat, cashIn, cashOut), oldestAt };
  }

  private async settings(schoolId: string, db: DbClient = prisma) {
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { cashAlertAmount: true, cashAlertDays: true } });
    return { cashAlertAmount: school?.cashAlertAmount ?? zero, cashAlertDays: school?.cashAlertDays ?? 0 };
  }

  private shape(
    user: { id: string; firstName: string; lastName: string; role: string; isActive: boolean },
    o: Awaited<ReturnType<CashDesksService['open']>>,
    settings: Awaited<ReturnType<CashDesksService['settings']>>,
    detail: boolean,
  ) {
    return {
      userId: user.id,
      name: fullName(user),
      role: user.role,
      isActive: user.isActive,
      openingFloat: money(o.openingFloat),
      cashIn: money(o.cashIn),
      cashOut: money(o.cashOut),
      expected: money(o.expected),
      paymentsCount: o.payments.length,
      expensesCount: o.expenses.length,
      oldestAt: o.oldestAt,
      lastHandoverAt: o.last?.createdAt ?? null,
      due: isDue(o, settings),
      ...(detail
        ? {
            payments: o.payments.map((p) => ({
              id: p.id,
              receiptNumber: p.receiptNumber,
              amount: money(p.totalAmount),
              isCorrection: p.isCorrection,
              date: p.valueDate,
              childName: fullName(p.child),
            })),
            expenses: o.expenses.map((e) => ({ id: e.id, description: e.description, category: e.category, amount: money(e.amount), date: e.date })),
          }
        : {}),
    };
  }

  private async officeUser(userId: string, schoolId: string, db: DbClient = prisma) {
    const user = await db.user.findFirst({
      where: { id: userId, schoolId, role: { in: [...OFFICE_ROLES] } },
      select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    if (!user) throw new CashDeskServiceError('Cash desk not found', 404);
    return user;
  }

  /** One person's desk, with what is in it. */
  async desk(userId: string, schoolId: string) {
    const [user, o, settings] = await Promise.all([this.officeUser(userId, schoolId), this.open(userId), this.settings(schoolId)]);
    return this.shape(user, o, settings, true);
  }

  /**
   * The school's desks: everyone who may record payments, and anyone who
   * still has money in theirs (rights taken away, account deactivated).
   */
  async list(schoolId: string) {
    const [users, settings] = await Promise.all([
      prisma.user.findMany({
        where: { schoolId, role: { in: [...OFFICE_ROLES] } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
      }),
      this.settings(schoolId),
    ]);
    const desks = await Promise.all(
      users.map(async (user) => {
        const [o, permissions] = await Promise.all([
          this.open(user.id),
          accessService.permissionsOf({ userId: user.id, role: user.role, schoolId }),
        ]);
        const cashier = user.isActive && allows(permissions, 'collections', 'edit');
        const holdsMoney = !o.expected.isZero() || o.payments.length > 0 || o.expenses.length > 0;
        return cashier || holdsMoney ? this.shape(user, o, settings, false) : null;
      }),
    );
    return {
      desks: desks.filter((d): d is NonNullable<typeof d> => d !== null),
      settings: { cashAlertAmount: money(settings.cashAlertAmount), cashAlertDays: settings.cashAlertDays },
    };
  }

  /** For the dashboard: is my desk due, and how many desks wait to be collected. */
  async summary(user: { userId: string; role: string; schoolId: string }) {
    const permissions = await accessService.permissionsOf(user);
    const mine = allows(permissions, 'collections', 'edit') ? await this.desk(user.userId, user.schoolId) : null;
    let toCollect: { count: number; total: string } | null = null;
    if (permissions.collectCash) {
      const { desks } = await this.list(user.schoolId);
      // A director's own desk is theirs to deposit: counted with the others.
      const due = desks.filter((d) => d.due && (d.userId !== user.userId || user.role === 'admin'));
      toCollect = { count: due.length, total: due.reduce((s, d) => s.add(d.expected), zero).toFixed(2) };
    }
    return {
      mine: mine ? { expected: mine.expected, due: mine.due, oldestAt: mine.oldestAt } : null,
      toCollect,
    };
  }

  /**
   * Counts a desk and takes its money. The difference with what should be
   * there is kept for good, with its reason. Nobody collects their own desk,
   * except a director, who deposits it (bank, safe).
   */
  async collect(actor: { userId: string; role: string; schoolId: string }, cashierUserId: string, input: CollectInput) {
    const own = actor.userId === cashierUserId;
    if (own && actor.role !== 'admin') throw new CashDeskServiceError('Nobody collects their own cash desk', 403, 'FORBIDDEN');
    const counted = new Prisma.Decimal(input.countedAmount);
    const floatLeft = new Prisma.Decimal(input.floatLeft);
    if (floatLeft.gt(counted)) throw new CashDeskServiceError('The float left cannot exceed the counted amount');
    const reason = input.reason?.trim() || null;

    return prisma.$transaction(async (tx) => {
      await this.officeUser(cashierUserId, actor.schoolId, tx);
      const o = await this.open(cashierUserId, tx);
      if (!o.payments.length && !o.expenses.length && o.openingFloat.isZero() && counted.isZero()) {
        throw new CashDeskServiceError('There is nothing to collect in this cash desk');
      }
      if (!o.expected.equals(new Prisma.Decimal(input.expectedAmount))) {
        throw new CashDeskServiceError('The cash desk changed meanwhile, check the amounts again', 409, 'CASH_DESK_CHANGED');
      }
      const difference = counted.sub(o.expected);
      if (!difference.isZero() && !reason) throw new CashDeskServiceError('A reason is required when the counted amount differs');

      const handover = await tx.cashHandover.create({
        data: {
          schoolId: actor.schoolId,
          cashierUserId,
          collectedByUserId: actor.userId,
          kind: own ? 'deposit' : 'handover',
          openingFloat: o.openingFloat,
          cashIn: o.cashIn,
          cashOut: o.cashOut,
          expectedAmount: o.expected,
          countedAmount: counted,
          floatLeft,
          difference,
          reason: difference.isZero() ? null : reason,
          note: input.note?.trim() || null,
        },
      });
      // Only what was counted: a payment recorded meanwhile stays in the desk.
      await tx.paymentRecord.updateMany({ where: { id: { in: o.payments.map((p) => p.id) }, cashHandoverId: null }, data: { cashHandoverId: handover.id } });
      await tx.expense.updateMany({ where: { id: { in: o.expenses.map((e) => e.id) }, cashHandoverId: null }, data: { cashHandoverId: handover.id } });
      return { id: handover.id };
    });
  }

  private shapeHandover(h: Prisma.CashHandoverGetPayload<{ include: { cashier: typeof person; collectedBy: typeof person } }>) {
    return {
      id: h.id,
      kind: h.kind,
      cashierUserId: h.cashierUserId,
      cashierName: fullName(h.cashier),
      collectedByName: fullName(h.collectedBy),
      openingFloat: money(h.openingFloat),
      cashIn: money(h.cashIn),
      cashOut: money(h.cashOut),
      expectedAmount: money(h.expectedAmount),
      countedAmount: money(h.countedAmount),
      floatLeft: money(h.floatLeft),
      taken: money(h.countedAmount.sub(h.floatLeft)),
      difference: money(h.difference),
      reason: h.reason,
      note: h.note,
      createdAt: h.createdAt,
    };
  }

  /** Past handovers, latest first (of one desk, or all). */
  async handovers(schoolId: string, cashierUserId?: string) {
    const list = await prisma.cashHandover.findMany({
      where: { schoolId, ...(cashierUserId ? { cashierUserId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { cashier: person, collectedBy: person },
    });
    return list.map((h) => this.shapeHandover(h));
  }

  /** One handover with what it counted (for the slip). `onlyCashier`: refused unless it is that person's desk. */
  async handover(id: string, schoolId: string, onlyCashier?: string) {
    const h = await prisma.cashHandover.findFirst({
      where: { id, schoolId, ...(onlyCashier ? { cashierUserId: onlyCashier } : {}) },
      include: {
        cashier: person,
        collectedBy: person,
        school: { select: { name: true } },
        payments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, receiptNumber: true, totalAmount: true, isCorrection: true, valueDate: true, child: { select: { firstName: true, lastName: true } } },
        },
        expenses: { orderBy: { createdAt: 'asc' }, select: { id: true, description: true, category: true, amount: true, date: true } },
      },
    });
    if (!h) throw new CashDeskServiceError('Handover not found', 404);
    return {
      ...this.shapeHandover(h),
      schoolName: h.school.name,
      payments: h.payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        amount: money(p.totalAmount),
        isCorrection: p.isCorrection,
        date: p.valueDate,
        childName: fullName(p.child),
      })),
      expenses: h.expenses.map((e) => ({ id: e.id, description: e.description, category: e.category, amount: money(e.amount), date: e.date })),
    };
  }

  /** When a desk is due: from how much money, after how many days (0: never). */
  async updateSettings(schoolId: string, input: { cashAlertAmount: number; cashAlertDays: number }) {
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { cashAlertAmount: input.cashAlertAmount, cashAlertDays: input.cashAlertDays },
      select: { cashAlertAmount: true, cashAlertDays: true },
    });
    return { cashAlertAmount: money(school.cashAlertAmount), cashAlertDays: school.cashAlertDays };
  }
}

export const cashDesksService = new CashDesksService();
