import { Request, Response, NextFunction } from 'express';
import { payrollService, PayrollError } from './payroll.service';
import { setSalarySchema, recordPaymentSchema } from './payroll.schema';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';

export const payrollController = {
  async listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const data = await payrollService.listEmployees(schoolId);
      res.status(200).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  async setSalary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { userId } = req.params;
      const parsed = setSalarySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Validation failed'));
        return;
      }
      const data = await payrollService.setSalary(schoolId, userId, parsed.data);
      res.status(200).json(successResponse(data));
    } catch (err) {
      if (err instanceof PayrollError) {
        res.status(err.statusCode).json(errorResponse('PAYROLL_ERROR', err.message));
        return;
      }
      next(err);
    }
  },

  async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20);
      const userId = req.query.userId as string | undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;

      const { items, total } = await payrollService.listPayments(schoolId, {
        userId,
        year,
        month,
        page,
        pageSize,
      });
      res.status(200).json(paginatedResponse(items, page, pageSize, total));
    } catch (err) {
      next(err);
    }
  },

  async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const parsed = recordPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Validation failed'));
        return;
      }
      const data = await payrollService.recordPayment(schoolId, parsed.data);
      res.status(201).json(successResponse(data));
    } catch (err) {
      if (err instanceof PayrollError) {
        res.status(err.statusCode).json(errorResponse('PAYROLL_ERROR', err.message));
        return;
      }
      next(err);
    }
  },

  async deletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      await payrollService.deletePayment(schoolId, id);
      res.status(204).send();
    } catch (err) {
      if (err instanceof PayrollError) {
        res.status(err.statusCode).json(errorResponse('PAYROLL_ERROR', err.message));
        return;
      }
      next(err);
    }
  },
};
