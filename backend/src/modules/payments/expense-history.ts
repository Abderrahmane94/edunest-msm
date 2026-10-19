import { Prisma, type Expense } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';

/** One field that changed: values as shown (amount "1500.00", date "2026-10-19", year by name). */
export interface ExpenseFieldChange {
  field: 'category' | 'description' | 'amount' | 'date' | 'academicYear' | 'paidFromCash' | 'receipt';
  from: string | boolean | null;
  to: string | boolean | null;
}

/** The expense as it was: enough to show it and to restore it. */
export interface ExpenseSnapshot {
  id: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  academicYearId: string | null;
  academicYearName: string | null;
  receiptPublicId: string | null;
  createdByUserId: string;
  paidFromCashUserId: string | null;
  clientId: string | null;
  createdAt: string;
  /** The purchase of supplies it was recorded with. */
  stockMovementId: string | null;
}

export interface ExpenseHistoryEntry {
  id: string;
  expenseId: string;
  action: 'created' | 'updated' | 'receipt' | 'deleted' | 'restored';
  changes: ExpenseFieldChange[];
  /** The expense as it was (created, deleted). */
  snapshot: ExpenseSnapshot | null;
  /** A receipt file kept with this step (the one replaced or deleted). */
  hasReceipt: boolean;
  byName: string;
  at: string;
}

/** Who did it, with the name at the time. */
export async function expenseAuthor(userId: string, db: DbClient = prisma): Promise<{ byUserId: string; byName: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  return { byUserId: userId, byName: user ? `${user.firstName} ${user.lastName}`.trim() : '' };
}

async function yearName(db: DbClient, id: string | null): Promise<string | null> {
  if (!id) return null;
  return (await db.academicYear.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
}

export async function snapshotOf(db: DbClient, expense: Expense, stockMovementId: string | null = null): Promise<ExpenseSnapshot> {
  return {
    id: expense.id,
    category: expense.category,
    description: expense.description,
    amount: expense.amount.toFixed(2),
    currency: expense.currency,
    date: expense.date.toISOString().slice(0, 10),
    academicYearId: expense.academicYearId,
    academicYearName: await yearName(db, expense.academicYearId),
    receiptPublicId: expense.receiptPublicId,
    createdByUserId: expense.createdByUserId,
    paidFromCashUserId: expense.paidFromCashUserId,
    clientId: expense.clientId,
    createdAt: expense.createdAt.toISOString(),
    stockMovementId,
  };
}

/** What differs between the expense before and after an edit, field by field. */
export async function fieldChanges(db: DbClient, before: Expense, after: Expense): Promise<ExpenseFieldChange[]> {
  const changes: ExpenseFieldChange[] = [];
  const add = (field: ExpenseFieldChange['field'], from: ExpenseFieldChange['from'], to: ExpenseFieldChange['to']) => {
    if (from !== to) changes.push({ field, from, to });
  };
  add('category', before.category, after.category);
  add('description', before.description, after.description);
  add('amount', before.amount.toFixed(2), after.amount.toFixed(2));
  add('date', before.date.toISOString().slice(0, 10), after.date.toISOString().slice(0, 10));
  if (before.academicYearId !== after.academicYearId) {
    add('academicYear', await yearName(db, before.academicYearId), await yearName(db, after.academicYearId));
  }
  add('paidFromCash', !!before.paidFromCashUserId, !!after.paidFromCashUserId);
  return changes;
}

export function recordExpenseChange(
  db: DbClient,
  data: {
    schoolId: string;
    expenseId: string;
    action: ExpenseHistoryEntry['action'];
    changes?: ExpenseFieldChange[];
    snapshot?: ExpenseSnapshot;
    receiptPublicId?: string | null;
    author: { byUserId: string; byName: string };
  },
) {
  return db.expenseChange.create({
    data: {
      schoolId: data.schoolId,
      expenseId: data.expenseId,
      action: data.action,
      changes: data.changes ? (data.changes as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      snapshot: data.snapshot ? (data.snapshot as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      receiptPublicId: data.receiptPublicId ?? null,
      ...data.author,
    },
  });
}

type ChangeRow = Awaited<ReturnType<typeof prisma.expenseChange.findMany>>[number];

export function toHistoryEntry(row: ChangeRow): ExpenseHistoryEntry {
  return {
    id: row.id,
    expenseId: row.expenseId,
    action: row.action as ExpenseHistoryEntry['action'],
    changes: (row.changes as unknown as ExpenseFieldChange[] | null) ?? [],
    snapshot: (row.snapshot as unknown as ExpenseSnapshot | null) ?? null,
    hasReceipt: !!row.receiptPublicId,
    byName: row.byName,
    at: row.createdAt.toISOString(),
  };
}
