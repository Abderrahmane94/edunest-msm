import prisma from '../../lib/prisma';
import { academicYearsService } from '../academic-years/academic-years.service';
import { cloudinaryService } from '../../services/cloudinary.service';
import { extensionForUpload, extensionOf, mimeTypeForExtension, sniffExtension } from '../../utils/file-type';
import type { CreateExpenseInput, ExpenseListFilters, UpdateExpenseInput } from './expense.schema';
import { Prisma } from '@prisma/client';
import {
  expenseAuthor,
  fieldChanges,
  recordExpenseChange,
  snapshotOf,
  toHistoryEntry,
  type ExpenseHistoryEntry,
  type ExpenseSnapshot,
} from './expense-history';

/** The last change to an expense after it was recorded, shown in the list. */
export interface ExpenseLastChange {
  action: 'updated' | 'receipt' | 'restored';
  byName: string;
  at: string;
}

export class ExpenseServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ExpenseServiceError';
  }
}

class ExpenseService {
  /**
   * Create a new expense for a school.
   */
  async create(schoolId: string, input: CreateExpenseInput, createdByUserId: string) {
    // Sent again (the first answer was lost, or the receipt that follows failed):
    // it is already saved, give it back instead of recording it twice.
    if (input.clientId) {
      const existing = await this.findByClientId(input.clientId, schoolId);
      if (existing) return existing;
    }
    const academicYearId = input.academicYearId
      ? await this.checkedYear(schoolId, input.academicYearId)
      : await academicYearsService.yearForDate(schoolId, new Date(input.date));
    try {
      return await this.insert(schoolId, input, createdByUserId, academicYearId);
    } catch (error) {
      // Two sends at once: the other one saved it.
      if (input.clientId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findByClientId(input.clientId, schoolId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async findByClientId(clientId: string, schoolId: string) {
    const existing = await prisma.expense.findUnique({ where: { clientId } });
    if (existing && existing.schoolId !== schoolId) {
      throw new ExpenseServiceError('This client ID belongs to another expense', 409);
    }
    return existing;
  }

  private insert(schoolId: string, input: CreateExpenseInput, createdByUserId: string, academicYearId: string | null) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          schoolId,
          clientId: input.clientId,
          category: input.category,
          description: input.description,
          amount: input.amount,
          currency: input.currency ?? 'DZD',
          date: new Date(input.date),
          academicYearId,
          createdByUserId,
          paidFromCashUserId: input.paidFromCash ? createdByUserId : null,
        },
      });
      await recordExpenseChange(tx, {
        schoolId,
        expenseId: expense.id,
        action: 'created',
        snapshot: await snapshotOf(tx, expense),
        author: await expenseAuthor(createdByUserId, tx),
      });
      return expense;
    });
  }

  /** An expense counted in a cash handover is part of that count for good. */
  private assertNotHandedOver(expense: { cashHandoverId: string | null }): void {
    if (expense.cashHandoverId) {
      throw new ExpenseServiceError('This expense was counted in a cash handover and can no longer be changed', 409);
    }
  }

  private async checkedYear(schoolId: string, academicYearId: string): Promise<string> {
    if (!(await academicYearsService.isSchoolYear(schoolId, academicYearId))) {
      throw new ExpenseServiceError('Academic year not found', 404);
    }
    return academicYearId;
  }

  /**
   * List expenses for a school with pagination.
   */
  async list(schoolId: string, page: number, pageSize: number, filters: ExpenseListFilters = {}) {
    const where: Prisma.ExpenseWhereInput = { schoolId };
    if (filters.academic_year_id) where.academicYearId = filters.academic_year_id;
    if (filters.category) where.category = filters.category;
    if (filters.from || filters.to) {
      where.date = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    if (filters.search) where.description = { contains: filters.search, mode: 'insensitive' };
    if (filters.hasReceipt === 'true') where.receiptPublicId = { not: null };
    if (filters.hasReceipt === 'false') where.receiptPublicId = null;

    const [expenses, total, sum] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    // Who last changed each one, once recorded.
    const lastChanges = expenses.length
      ? await prisma.expenseChange.findMany({
          where: { expenseId: { in: expenses.map((e) => e.id) }, action: { in: ['updated', 'receipt', 'restored'] } },
          orderBy: { createdAt: 'desc' },
          select: { expenseId: true, action: true, byName: true, createdAt: true },
        })
      : [];
    const lastOf = new Map<string, ExpenseLastChange>();
    for (const c of lastChanges) {
      if (!lastOf.has(c.expenseId)) {
        lastOf.set(c.expenseId, { action: c.action as ExpenseLastChange['action'], byName: c.byName, at: c.createdAt.toISOString() });
      }
    }

    // Sum over every matching expense, not just this page.
    return {
      expenses: expenses.map((e) => ({ ...e, lastChange: lastOf.get(e.id) ?? null })),
      total,
      totalAmount: sum._sum.amount?.toFixed(2) ?? '0.00',
    };
  }

  /**
   * Get a single expense by ID, scoped to the school.
   */
  async getById(id: string, schoolId: string) {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    return expense;
  }

  /**
   * Update an expense.
   */
  async update(id: string, schoolId: string, input: UpdateExpenseInput, userId?: string) {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }
    this.assertNotHandedOver(expense);
    // Whose desk it was paid from stays; ticking it takes it from the desk of whoever edits.
    const paidFromCashUserId =
      input.paidFromCash === undefined ? undefined : input.paidFromCash ? (expense.paidFromCashUserId ?? userId ?? null) : null;
    if (input.academicYearId) await this.checkedYear(schoolId, input.academicYearId);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          ...(input.academicYearId !== undefined && { academicYearId: input.academicYearId }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.currency !== undefined && { currency: input.currency }),
          ...(input.date !== undefined && { date: new Date(input.date) }),
          ...(paidFromCashUserId !== undefined && { paidFromCashUserId }),
        },
      });
      // Saved without a change: nothing to tell.
      const changes = await fieldChanges(tx, expense, updated);
      if (changes.length) {
        await recordExpenseChange(tx, {
          schoolId,
          expenseId: id,
          action: 'updated',
          changes,
          author: await expenseAuthor(userId ?? expense.createdByUserId, tx),
        });
      }
      return updated;
    });
  }

  /**
   * Delete an expense.
   */
  async delete(id: string, schoolId: string, userId: string): Promise<void> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }
    this.assertNotHandedOver(expense);

    // Kept in its history, receipt included: it can be looked at and restored.
    await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUnique({ where: { expenseId: id }, select: { id: true } });
      await recordExpenseChange(tx, {
        schoolId,
        expenseId: id,
        action: 'deleted',
        snapshot: await snapshotOf(tx, expense, movement?.id ?? null),
        receiptPublicId: expense.receiptPublicId,
        author: await expenseAuthor(userId, tx),
      });
      await tx.expense.delete({ where: { id } });
    });
  }

  /** Everything that happened to an expense, oldest first. */
  async history(id: string, schoolId: string): Promise<ExpenseHistoryEntry[]> {
    const rows = await prisma.expenseChange.findMany({ where: { expenseId: id, schoolId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toHistoryEntry);
  }

  /** Deleted expenses not restored since, newest first; of a school year when given. */
  async listDeleted(schoolId: string, academicYearId?: string): Promise<ExpenseHistoryEntry[]> {
    const rows = await prisma.expenseChange.findMany({
      where: { schoolId, action: 'deleted' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const ids = [...new Set(rows.map((r) => r.expenseId))];
    const back = new Set(
      (await prisma.expense.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((e) => e.id),
    );
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        if (back.has(r.expenseId) || seen.has(r.expenseId)) return false;
        seen.add(r.expenseId);
        return true;
      })
      .map(toHistoryEntry)
      .filter((e) => !academicYearId || e.snapshot?.academicYearId === academicYearId);
  }

  /** The deletion step of an expense, with the expense as it was. */
  async deletedChange(changeId: string, schoolId: string): Promise<ExpenseSnapshot> {
    const change = await prisma.expenseChange.findFirst({ where: { id: changeId, schoolId, action: 'deleted' } });
    if (!change?.snapshot) throw new ExpenseServiceError('Deleted expense not found', 404);
    return change.snapshot as unknown as ExpenseSnapshot;
  }

  /** Puts a deleted expense back as it was, with its receipt and its supplies purchase. */
  async restore(changeId: string, schoolId: string, userId: string) {
    const snapshot = await this.deletedChange(changeId, schoolId);
    if (await prisma.expense.findUnique({ where: { id: snapshot.id }, select: { id: true } })) {
      throw new ExpenseServiceError('This expense was already restored', 409);
    }
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          id: snapshot.id,
          schoolId,
          category: snapshot.category,
          description: snapshot.description,
          amount: new Prisma.Decimal(snapshot.amount),
          currency: snapshot.currency,
          date: new Date(snapshot.date),
          academicYearId: snapshot.academicYearId,
          receiptPublicId: snapshot.receiptPublicId,
          createdByUserId: snapshot.createdByUserId,
          paidFromCashUserId: snapshot.paidFromCashUserId,
          createdAt: new Date(snapshot.createdAt),
        },
      });
      if (snapshot.stockMovementId) {
        await tx.stockMovement.updateMany({
          where: { id: snapshot.stockMovementId, schoolId, expenseId: null },
          data: { expenseId: expense.id },
        });
      }
      await recordExpenseChange(tx, { schoolId, expenseId: expense.id, action: 'restored', author: await expenseAuthor(userId, tx) });
      return expense;
    });
  }

  /** A receipt kept in an expense's history (the one replaced, or a deleted expense's). */
  async getChangeReceiptFile(changeId: string, schoolId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const change = await prisma.expenseChange.findFirst({ where: { id: changeId, schoolId } });
    if (!change?.receiptPublicId) throw new ExpenseServiceError('No receipt kept for this change', 404);
    const buffer = await cloudinaryService.downloadFile(change.receiptPublicId, 'document');
    const extension = sniffExtension(buffer) ?? extensionOf(change.receiptPublicId) ?? 'bin';
    return { buffer, fileName: `${change.createdAt.toISOString().slice(0, 10)} - receipt.${extension}`, mimeType: mimeTypeForExtension(extension) };
  }

  /**
   * Upload a receipt for an expense. Stores the file in Cloudinary and saves
   * the public_id.
   */
  async uploadReceipt(
    id: string,
    schoolId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
    userId: string,
  ) {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    // Keep the uploaded format: store the file under its real extension.
    const extension = extensionForUpload(file.originalName, file.mimeType) ?? sniffExtension(file.buffer) ?? undefined;
    const uploadResult = await cloudinaryService.uploadFile(file.buffer, {
      folder: `schools/${schoolId}/expenses`,
      resourceType: 'raw',
      accessMode: 'authenticated',
      extension,
      mimeType: file.mimeType,
    });

    // The receipt it replaces stays readable in the history.
    return prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({ where: { id }, data: { receiptPublicId: uploadResult.publicId } });
      await recordExpenseChange(tx, {
        schoolId,
        expenseId: id,
        action: 'receipt',
        changes: [{ field: 'receipt', from: !!expense.receiptPublicId, to: true }],
        receiptPublicId: expense.receiptPublicId,
        author: await expenseAuthor(userId, tx),
      });
      return updated;
    });
  }

  /**
   * Fetches an expense's receipt with its real type and a readable name
   * ("<date> - <description>.<ext>"). Receipts stored before extensions were
   * kept get their type from the file's content.
   */
  async getReceiptFile(
    id: string,
    schoolId: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    if (!expense.receiptPublicId) {
      throw new ExpenseServiceError('No receipt uploaded for this expense', 404);
    }

    const buffer = await cloudinaryService.downloadFile(expense.receiptPublicId, 'document');
    const extension = sniffExtension(buffer) ?? extensionOf(expense.receiptPublicId) ?? 'bin';

    const date = expense.date.toISOString().slice(0, 10);
    const description = expense.description
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const fileName = `${date}${description ? ` - ${description}` : ''}.${extension}`;

    return { buffer, fileName, mimeType: mimeTypeForExtension(extension) };
  }
}

export const expenseService = new ExpenseService();
