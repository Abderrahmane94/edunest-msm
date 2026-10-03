import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { extensionForUpload, extensionOf, mimeTypeForExtension, sniffExtension } from '../../utils/file-type';
import type { CreateExpenseInput, ExpenseListFilters, UpdateExpenseInput } from './expense.schema';
import type { Prisma } from '@prisma/client';

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
  async list(schoolId: string, page: number, pageSize: number, filters: ExpenseListFilters = {}) {
    const where: Prisma.ExpenseWhereInput = { schoolId };
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

    // Sum over every matching expense, not just this page.
    return { expenses, total, totalAmount: sum._sum.amount?.toFixed(2) ?? '0.00' };
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
  async uploadReceipt(
    id: string,
    schoolId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ) {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new ExpenseServiceError('Expense not found', 404);
    }

    if (expense.receiptPublicId) {
      await cloudinaryService.deleteFile(expense.receiptPublicId);
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

    return prisma.expense.update({
      where: { id },
      data: { receiptPublicId: uploadResult.publicId },
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
