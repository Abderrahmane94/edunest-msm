import { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';

/** Unpaid amount of a child in one school year. */
export interface YearUnpaid {
  id: string;
  name: string;
  amount: string;
}

/**
 * What each child still owes in the school years before `yearId`, per year:
 * charges not cancelled minus what was paid on them. Years owing nothing are left out.
 */
export async function unpaidByYear(
  childIds: string[],
  yearId: string,
  db: DbClient = prisma,
): Promise<Map<string, YearUnpaid[]>> {
  const result = new Map<string, YearUnpaid[]>();
  if (childIds.length === 0) return result;
  const year = await db.academicYear.findUnique({ where: { id: yearId }, select: { startDate: true } });
  if (!year) return result;
  const periods = await db.billingPeriod.findMany({
    where: {
      cancelledAt: null,
      enrollment: {
        childId: { in: childIds },
        academicYear: { startDate: { lt: year.startDate } },
      },
    },
    select: {
      amountDue: true,
      paymentAllocations: { select: { amount: true } },
      enrollment: {
        select: { childId: true, academicYear: { select: { id: true, name: true, startDate: true } } },
      },
    },
  });
  const sums = new Map<string, { childId: string; year: { id: string; name: string; startDate: Date }; amount: Prisma.Decimal }>();
  for (const p of periods) {
    const paid = p.paymentAllocations.reduce((s, a) => s.add(a.amount), new Prisma.Decimal(0));
    const owed = p.amountDue.sub(paid);
    if (owed.lte(0)) continue;
    const key = `${p.enrollment.childId}:${p.enrollment.academicYear.id}`;
    const entry = sums.get(key) ?? { childId: p.enrollment.childId, year: p.enrollment.academicYear, amount: new Prisma.Decimal(0) };
    entry.amount = entry.amount.add(owed);
    sums.set(key, entry);
  }
  for (const { childId, year, amount } of [...sums.values()].sort(
    (a, b) => b.year.startDate.getTime() - a.year.startDate.getTime(),
  )) {
    const list = result.get(childId) ?? [];
    list.push({ id: year.id, name: year.name, amount: amount.toFixed(2) });
    result.set(childId, list);
  }
  return result;
}
