import { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';
import { academicYearsService } from '../academic-years/academic-years.service';
import { expenseAuthor, recordExpenseChange, snapshotOf } from '../payments/expense-history';
import type { CreateStockItemInput, CreateStockMovementInput, UpdateStockItemInput } from './inventory.schema';

export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'InventoryServiceError';
  }
}

/** Below (or at) its alert threshold: to buy again. */
const isLow = (item: { quantity: Prisma.Decimal; alertThreshold: Prisma.Decimal; isActive: boolean }) =>
  item.isActive && item.alertThreshold.gt(0) && item.quantity.lte(item.alertThreshold);

const withLow = <T extends { quantity: Prisma.Decimal; alertThreshold: Prisma.Decimal; isActive: boolean }>(item: T) => ({
  ...item,
  isLow: isLow(item),
});

class InventoryService {
  /** The school's supplies, by name, each flagged when it is time to buy it again. */
  async list(schoolId: string) {
    const items = await prisma.stockItem.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
    return items.map(withLow);
  }

  /** How many supplies are to buy again (dashboard). */
  async lowCount(schoolId: string): Promise<number> {
    const items = await prisma.stockItem.findMany({
      where: { schoolId, isActive: true, alertThreshold: { gt: 0 } },
      select: { quantity: true, alertThreshold: true, isActive: true },
    });
    return items.filter(isLow).length;
  }

  async create(schoolId: string, input: CreateStockItemInput, userId: string) {
    await this.assertNameFree(schoolId, input.name);
    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          schoolId,
          name: input.name,
          category: input.category,
          unit: input.unit,
          alertThreshold: new Prisma.Decimal(input.alertThreshold),
          notes: input.notes || null,
        },
      });
      // What is already there is recorded as a first count.
      if (input.initialQuantity > 0) {
        await this.move(tx, schoolId, item.id, userId, {
          type: 'adjustment',
          quantity: input.initialQuantity,
          date: new Date().toISOString().slice(0, 10),
        });
      }
      return withLow(await tx.stockItem.findUniqueOrThrow({ where: { id: item.id } }));
    });
  }

  async update(id: string, schoolId: string, input: UpdateStockItemInput) {
    await this.find(id, schoolId);
    if (input.name !== undefined) await this.assertNameFree(schoolId, input.name, id);
    const item = await prisma.stockItem.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(input.alertThreshold !== undefined && { alertThreshold: new Prisma.Decimal(input.alertThreshold) }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return withLow(item);
  }

  /** Only a supply never moved can be deleted; others are put aside (isActive). */
  async delete(id: string, schoolId: string) {
    await this.find(id, schoolId);
    const moved = await prisma.stockMovement.count({ where: { itemId: id } });
    if (moved > 0) {
      throw new InventoryServiceError('This supply has a history: put it aside instead of deleting it', 409);
    }
    await prisma.stockItem.delete({ where: { id } });
  }

  /** A supply's movements, latest first, with who recorded them. */
  async movements(id: string, schoolId: string) {
    await this.find(id, schoolId);
    return prisma.stockMovement.findMany({
      where: { itemId: id, schoolId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        expense: { select: { id: true, amount: true } },
      },
    });
  }

  /** Records a purchase (with its expense), a use, or a count. Teachers record uses only. */
  async recordMovement(
    id: string,
    schoolId: string,
    userId: string,
    role: string,
    input: CreateStockMovementInput,
    canRecordExpense = role === 'admin' || role === 'super_admin',
  ) {
    if (role === 'teacher' && input.type !== 'use') {
      throw new InventoryServiceError('Only an administrator can record purchases and counts', 403);
    }
    // Recording the expense too needs the right to manage expenses.
    if (input.type === 'purchase' && input.expense && !canRecordExpense) {
      throw new InventoryServiceError('Only the director can record expenses', 403);
    }
    const item = await this.find(id, schoolId);
    if (!item.isActive) throw new InventoryServiceError('This supply is put aside', 400);
    return prisma.$transaction(async (tx) => {
      const movement = await this.move(tx, schoolId, id, userId, input);
      const updated = await tx.stockItem.findUniqueOrThrow({ where: { id } });
      return { movement, item: withLow(updated) };
    });
  }

  private async move(tx: DbClient, schoolId: string, itemId: string, userId: string, input: CreateStockMovementInput) {
    const item = await tx.stockItem.findUniqueOrThrow({ where: { id: itemId } });
    const day = new Date(input.date);
    const academicYearId = await academicYearsService.yearForDate(schoolId, day, tx);
    const qty = new Prisma.Decimal(input.quantity);
    const delta = input.type === 'purchase' ? qty : input.type === 'use' ? qty.neg() : qty.sub(item.quantity);
    const after = item.quantity.add(delta);
    if (after.lt(0)) {
      throw new InventoryServiceError(`Not enough in stock (${item.quantity.toString()} ${item.unit} left)`, 409);
    }

    let expenseId: string | null = null;
    if (input.type === 'purchase' && input.expense) {
      const expense = await tx.expense.create({
        data: {
          schoolId,
          category: input.expense.category,
          description: `${item.name} — ${qty.toString()} ${item.unit}`,
          amount: new Prisma.Decimal(input.expense.amount),
          currency: 'DZD',
          date: day,
          academicYearId,
          createdByUserId: userId,
        },
      });
      await recordExpenseChange(tx, {
        schoolId,
        expenseId: expense.id,
        action: 'created',
        snapshot: await snapshotOf(tx, expense),
        author: await expenseAuthor(userId, tx),
      });
      expenseId = expense.id;
    }

    await tx.stockItem.update({ where: { id: itemId }, data: { quantity: after } });
    return tx.stockMovement.create({
      data: {
        schoolId,
        itemId,
        type: input.type,
        quantity: delta,
        stockAfter: after,
        date: day,
        academicYearId,
        note: input.note || null,
        expenseId,
        createdByUserId: userId,
      },
    });
  }

  private async find(id: string, schoolId: string) {
    const item = await prisma.stockItem.findFirst({ where: { id, schoolId } });
    if (!item) throw new InventoryServiceError('Supply not found', 404);
    return item;
  }

  private async assertNameFree(schoolId: string, name: string, exceptId?: string) {
    const same = await prisma.stockItem.findFirst({
      where: { schoolId, name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (same) throw new InventoryServiceError('A supply with this name already exists', 409);
  }
}

export const inventoryService = new InventoryService();
