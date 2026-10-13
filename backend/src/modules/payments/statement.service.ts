import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { derivePeriodStatus } from './billing-period.service';

export class StatementServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'StatementServiceError';
  }
}

const ZERO = new Prisma.Decimal(0);
const day = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: Prisma.Decimal) => value.toFixed(2);

export interface StatementLine {
  id: string;
  feeName: string | null;
  isRegistration: boolean;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  /** Before any discount. */
  baseAmount: string;
  discount: string;
  amountDue: string;
  paid: string;
  outstanding: string;
  status: 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
  isLate: boolean;
}

export interface StatementPayment {
  id: string;
  receiptNumber: string;
  valueDate: string;
  channel: string;
  /** What of it went to this year's échéances (negative for a correction). */
  amount: string;
  isCorrection: boolean;
  referenceNote: string | null;
}

export interface Statement {
  child: { id: string; firstName: string; lastName: string; classroom: string | null };
  /** No billing that year: nothing was invoiced. */
  enrolled: boolean;
  lines: StatementLine[];
  payments: StatementPayment[];
  totals: { base: string; discount: string; billed: string; paid: string; outstanding: string; late: string };
}

export interface StatementDocument {
  school: { name: string; address: string; wilaya: string; contactPhone: string; contactEmail: string };
  year: { id: string; name: string; startDate: string; endDate: string };
  generatedOn: string;
  parents: { firstName: string; lastName: string; email: string; phone: string | null; relationship: string }[];
  /** The child asked for first, then their brothers and sisters when the family is asked for. */
  statements: Statement[];
  /** Everything together, when there are several children. */
  totals: Statement['totals'];
  /** Whether the child has brothers or sisters at the school (the family statement has more to say). */
  hasSiblings: boolean;
}

class StatementService {
  private async year(schoolId: string, academicYearId?: string) {
    const year = await prisma.academicYear.findFirst({
      where: academicYearId ? { id: academicYearId, schoolId } : { schoolId, isActive: true },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!year) throw new StatementServiceError(academicYearId ? 'Academic year not found' : 'No active academic year', 404);
    return year;
  }

  /** The other children of the child's parents, at the same school. */
  private async siblingIds(schoolId: string, childId: string): Promise<string[]> {
    const links = await prisma.parentChildLink.findMany({ where: { childId }, select: { parentUserId: true } });
    if (links.length === 0) return [];
    const others = await prisma.parentChildLink.findMany({
      where: { parentUserId: { in: links.map((l) => l.parentUserId) }, childId: { not: childId }, child: { schoolId, deletedAt: null } },
      select: { childId: true, child: { select: { firstName: true } } },
      orderBy: { child: { firstName: 'asc' } },
    });
    return [...new Set(others.map((o) => o.childId))];
  }

  /** What one child was invoiced and paid over a school year. */
  private async of(childId: string, yearId: string, today: Date): Promise<Statement> {
    const child = await prisma.child.findUniqueOrThrow({
      where: { id: childId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        enrollments: { where: { classroom: { academicYearId: yearId, deletedAt: null } }, select: { classroom: { select: { name: true } } }, take: 1 },
      },
    });
    const periods = await prisma.billingPeriod.findMany({
      where: { cancelledAt: null, enrollment: { childId, academicYearId: yearId } },
      orderBy: [{ periodStart: 'asc' }, { isRegistrationPeriod: 'desc' }, { createdAt: 'asc' }],
      include: {
        branchFee: { select: { name: true } },
        paymentAllocations: { select: { amount: true, paymentRecordId: true } },
      },
    });
    const enrolled = (await prisma.enrollment.count({ where: { childId, academicYearId: yearId } })) > 0;

    let base = ZERO, billed = ZERO, paid = ZERO, late = ZERO;
    const perPayment = new Map<string, Prisma.Decimal>();
    const lines: StatementLine[] = periods.map((p) => {
      const linePaid = p.paymentAllocations.reduce((sum, a) => sum.add(a.amount), ZERO);
      for (const a of p.paymentAllocations) perPayment.set(a.paymentRecordId, (perPayment.get(a.paymentRecordId) ?? ZERO).add(a.amount));
      const derived = derivePeriodStatus(p.amountDue, linePaid, p.graceEndDate, today, p.cancelledAt);
      const lineBase = p.baseAmount ?? p.amountDue;
      const outstanding = p.amountDue.minus(linePaid);
      base = base.add(lineBase);
      billed = billed.add(p.amountDue);
      paid = paid.add(linePaid);
      if (derived.isLate) late = late.add(outstanding);
      return {
        id: p.id,
        feeName: p.branchFee?.name ?? null,
        isRegistration: p.isRegistrationPeriod,
        periodStart: day(p.periodStart),
        periodEnd: day(p.periodEnd),
        dueDate: day(p.dueDate),
        baseAmount: money(lineBase),
        discount: money(lineBase.minus(p.amountDue)),
        amountDue: money(p.amountDue),
        paid: money(linePaid),
        outstanding: money(outstanding),
        status: derived.status,
        isLate: derived.isLate,
      };
    });

    const records = perPayment.size
      ? await prisma.paymentRecord.findMany({
          where: { id: { in: [...perPayment.keys()] } },
          orderBy: [{ valueDate: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, receiptNumber: true, valueDate: true, channel: true, isCorrection: true, referenceNote: true },
        })
      : [];

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName, classroom: child.enrollments[0]?.classroom.name ?? null },
      enrolled,
      lines,
      payments: records.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        valueDate: day(r.valueDate),
        channel: r.channel,
        amount: money(perPayment.get(r.id) ?? ZERO),
        isCorrection: r.isCorrection,
        referenceNote: r.referenceNote,
      })),
      totals: { base: money(base), discount: money(base.minus(billed)), billed: money(billed), paid: money(paid), outstanding: money(billed.minus(paid)), late: money(late) },
    };
  }

  /**
   * The statement of account of a child for a school year (the one in
   * progress by default): every échéance, every payment, what is left to pay.
   * With `family`, their brothers' and sisters' as well, and the totals of all.
   */
  async document(schoolId: string, childId: string, options: { academicYearId?: string; family?: boolean } = {}): Promise<StatementDocument> {
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId, deletedAt: null },
      select: {
        id: true,
        school: { select: { name: true, address: true, wilaya: true, contactPhone: true, contactEmail: true } },
        parentLinks: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { relationship: true, parent: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        },
      },
    });
    if (!child) throw new StatementServiceError('Child not found', 404);
    const year = await this.year(schoolId, options.academicYearId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const siblings = await this.siblingIds(schoolId, childId);
    const statements: Statement[] = [];
    for (const id of [childId, ...(options.family ? siblings : [])]) {
      const statement = await this.of(id, year.id, today);
      // A brother or sister who was not invoiced that year adds nothing to the page.
      if (id === childId || statement.enrolled) statements.push(statement);
    }

    const sum = (key: keyof Statement['totals']) => money(statements.reduce((n, s) => n.add(new Prisma.Decimal(s.totals[key])), ZERO));
    return {
      school: child.school,
      year: { id: year.id, name: year.name, startDate: day(year.startDate), endDate: day(year.endDate) },
      generatedOn: day(new Date(Date.now() + 3600 * 1000)),
      parents: child.parentLinks.map((l) => ({ ...l.parent, relationship: l.relationship })),
      statements,
      totals: { base: sum('base'), discount: sum('discount'), billed: sum('billed'), paid: sum('paid'), outstanding: sum('outstanding'), late: sum('late') },
      hasSiblings: siblings.length > 0,
    };
  }

  /** Whether the user is a parent of the child. */
  async isParentOf(userId: string, childId: string): Promise<boolean> {
    return (await prisma.parentChildLink.count({ where: { parentUserId: userId, childId } })) > 0;
  }

  /** Where a statement goes when no address is given: the child's first parent. */
  async defaultRecipient(childId: string): Promise<string | null> {
    const link = await prisma.parentChildLink.findFirst({ where: { childId }, orderBy: { isPrimary: 'desc' }, select: { parent: { select: { email: true } } } });
    return link?.parent.email ?? null;
  }
}

export const statementService = new StatementService();
