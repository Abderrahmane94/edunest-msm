import { Request, Response, NextFunction } from 'express';
import { expenseService, ExpenseServiceError } from './expense.service';
import { expenseListFiltersSchema, type CreateExpenseInput, type UpdateExpenseInput } from './expense.schema';
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response';
import { paginationSchema } from '../../utils/validators';
import { contentDisposition } from '../../utils/file-type';
import { can, NOT_ALLOWED_MESSAGE } from '../../middleware/permission.middleware';

/** Only whoever records payments has a cash desk to pay from. */
async function refusedCash(req: Request, res: Response): Promise<boolean> {
  if (!(req.body as { paidFromCash?: boolean }).paidFromCash || (await can(req, 'collections', 'edit'))) return false;
  res.status(403).json(errorResponse('FORBIDDEN', NOT_ALLOWED_MESSAGE));
  return true;
}

export const expenseController = {
  /**
   * POST /api/payments/expenses
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const input = req.body as CreateExpenseInput;
      if (await refusedCash(req, res)) return;
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
        res.status(400).json(errorResponse('VALIDATION_ERROR', filters.error.issues[0]?.message ?? 'Invalid filters'));
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
      if (await refusedCash(req, res)) return;
      const expense = await expenseService.update(id, schoolId, input, req.user!.userId);
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
      await expenseService.delete(id, schoolId, req.user!.userId);
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
      }, req.user!.userId);
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
   * GET /api/payments/expenses/:id/history — Everything that happened to an expense
   */
  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await expenseService.history(req.params.id, req.user!.schoolId!)));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/payments/expenses/deleted?academic_year_id= — Deleted expenses, with who and when
   */
  async listDeleted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = typeof req.query.academic_year_id === 'string' ? req.query.academic_year_id : undefined;
      res.status(200).json(successResponse(await expenseService.listDeleted(req.user!.schoolId!, year)));
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/payments/expenses/changes/:id/restore — Puts a deleted expense back
   */
  async restore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const expense = await expenseService.restore(req.params.id, req.user!.schoolId!, req.user!.userId);
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
   * GET /api/payments/expenses/changes/:id/receipt — A receipt kept in the history
   */
  async getChangeReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendFile(res, await expenseService.getChangeReceiptFile(req.params.id, req.user!.schoolId!));
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
      sendFile(res, await expenseService.getReceiptFile(id, schoolId));
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        res.status(error.statusCode).json(errorResponse('EXPENSE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};

/** Streams a receipt with its real type and a readable file name. */
function sendFile(res: Response, file: { buffer: Buffer; fileName: string; mimeType: string }): void {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', contentDisposition('inline', file.fileName));
  // The frontend is on another origin and reads the name from this header.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(file.buffer);
}
