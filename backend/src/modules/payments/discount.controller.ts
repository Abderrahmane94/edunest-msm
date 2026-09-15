import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { discountService, DiscountServiceError } from './discount.service';
import { createDiscountSchema, updateDiscountSchema } from './discount.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateEnrollmentAccess } from './tenant-scope.middleware';

function mapZodErrors(error: ZodError) {
  return error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
}

export const discountController = {
  /**
   * POST /api/payments/enrollments/:enrollmentId/discounts
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enrollmentId } = req.params;

      const validatedBranch = await validateEnrollmentAccess(enrollmentId, req, res);
      if (!validatedBranch) return;

      const parsed = createDiscountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', mapZodErrors(parsed.error)),
        );
        return;
      }

      const discount = await discountService.create(enrollmentId, parsed.data, req.user!.userId);
      res.status(201).json(successResponse(discount));
    } catch (error) {
      if (error instanceof DiscountServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/enrollments/:enrollmentId/discounts
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enrollmentId } = req.params;

      const validatedBranch = await validateEnrollmentAccess(enrollmentId, req, res);
      if (!validatedBranch) return;

      const discounts = await discountService.listByEnrollment(enrollmentId);
      res.status(200).json(successResponse(discounts));
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/payments/discounts/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const enrollmentId = await discountService.getEnrollmentIdForDiscount(id);
      if (!enrollmentId) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Discount not found'));
        return;
      }

      const validatedBranch = await validateEnrollmentAccess(enrollmentId, req, res);
      if (!validatedBranch) return;

      const parsed = updateDiscountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', mapZodErrors(parsed.error)),
        );
        return;
      }

      const discount = await discountService.update(id, parsed.data);
      res.status(200).json(successResponse(discount));
    } catch (error) {
      if (error instanceof DiscountServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/payments/discounts/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const enrollmentId = await discountService.getEnrollmentIdForDiscount(id);
      if (!enrollmentId) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Discount not found'));
        return;
      }

      const validatedBranch = await validateEnrollmentAccess(enrollmentId, req, res);
      if (!validatedBranch) return;

      await discountService.delete(id);
      res.status(200).json(successResponse({ message: 'Discount deleted successfully' }));
    } catch (error) {
      if (error instanceof DiscountServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },
};
