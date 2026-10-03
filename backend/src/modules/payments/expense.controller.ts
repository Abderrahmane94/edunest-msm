import { Request, Response, NextFunction } from 'express';
import { expenseService, ExpenseServiceError } from './expense.service';
import { expenseListFiltersSchema, type CreateExpenseInput, type UpdateExpenseInput } from './expense.schema';
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response';
import { paginationSchema } from '../../utils/validators';
import { contentDisposition } from '../../utils/file-type';

export const expenseController = {
  /**
   * POST /api/payments/expenses
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const input = req.body as CreateExpenseInput;
      const expense = await expenseService.create(schoolId, input, userId);
      res.status(201).json(successResponse(expense));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/expenses
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const filters = expenseListFiltersSchema.safeParse(req.query);
      if (!filters.success) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', filters.error.errors[0]?.message ?? 'Invalid filters'));
        return;
      }
      const { expenses, total, totalAmount } = await expenseService.list(schoolId, page, pageSize, filters.data);
      const response = paginatedResponse(expenses, page, pageSize, total);
      res.status(200).json({ ...response, meta: { ...response.meta, totalAmount } });
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/expenses/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const expense = await expenseService.getById(id, schoolId);
      res.status(200).json(successResponse(expense));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/payments/expenses/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const input = req.body as UpdateExpenseInput;
      const expense = await expenseService.update(id, schoolId, input);
      res.status(200).json(successResponse(expense));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/payments/expenses/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      await expenseService.delete(id, schoolId);
      res.status(200).json(successResponse({ message: 'Expense deleted successfully' }));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/payments/expenses/:id/receipt
   */
  async uploadReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;

      if (!req.file) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'No file uploaded'));
        return;
      }

      const expense = await expenseService.uploadReceipt(id, schoolId, {
        buffer: req.file.buffer,
        // Multer decodes the multipart file name as latin1; browsers send UTF-8.
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        mimeType: req.file.mimetype,
      });
      res.status(200).json(successResponse(expense));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/expenses/:id/receipt
   * Streams the receipt file with its real type and a readable file name.
   */
  async getReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const file = await expenseService.getReceiptFile(id, schoolId);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', contentDisposition('inline', file.fileName));
      // The frontend is on another origin and reads the name from this header.
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).send(file.buffer);
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
