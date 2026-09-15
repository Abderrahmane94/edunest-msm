import { Request, Response, NextFunction } from 'express';
import { expenseService, ExpenseServiceError } from './expense.service';
import type { CreateExpenseInput, UpdateExpenseInput } from './expense.schema';
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response';
import { paginationSchema } from '../../utils/validators';

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
      const { expenses, total } = await expenseService.list(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(expenses, page, pageSize, total));
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

      const expense = await expenseService.uploadReceipt(id, schoolId, req.file.buffer);
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
   * GET /api/payments/expenses/:id/receipt-url
   */
  async getReceiptUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const url = await expenseService.getReceiptUrl(id, schoolId);
      res.status(200).json(successResponse({ url }));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
