import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import type { CreateExpenseInput, UpdateExpenseInput } from './expense.schema';

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
    return prisma.expense.create({
      data: {
        schoolId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        currency: input.currency ?? 'DZD',
        date: new Date(input.date),
        createdByUserId,
      },
    });
  }

  /**
   * List expenses for a school with pagination.
   */
  async list(schoolId: string, page: number, pageSize: number) {
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: { schoolId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      prisma.expense.count({ where: { schoolId } }),
    ]);

    return { expenses, total };
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
  async update(id: string, schoolId: string, input: UpdateExpenseInput) {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    return prisma.expense.update({
      where: { id },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.date !== undefined && { date: new Date(input.date) }),
      },
    });
  }

  /**
   * Delete an expense.
   */
  async delete(id: string, schoolId: string): Promise<void> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    if (expense.receiptPublicId) {
      await cloudinaryService.deleteFile(expense.receiptPublicId);
    }

    await prisma.expense.delete({ where: { id } });
  }

  /**
   * Upload a receipt for an expense. Stores the file in Cloudinary and saves
   * the public_id.
   */
  async uploadReceipt(id: string, schoolId: string, file: Buffer) {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    if (expense.receiptPublicId) {
      await cloudinaryService.deleteFile(expense.receiptPublicId);
    }

    const uploadResult = await cloudinaryService.uploadFile(file, {
      folder: `schools/${schoolId}/expenses`,
      resourceType: 'raw',
      accessMode: 'authenticated',
    });

    return prisma.expense.update({
      where: { id },
      data: { receiptPublicId: uploadResult.publicId },
    });
  }

  /**
   * Get a signed URL for an expense receipt (24-hour expiry).
   */
  async getReceiptUrl(id: string, schoolId: string): Promise<string> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    if (!expense.receiptPublicId) {
      throw new ExpenseServiceError('No receipt uploaded for this expense', 404);
    }

    return cloudinaryService.generateSignedUrl(expense.receiptPublicId, 'document');
  }
}

export const expenseService = new ExpenseService();
