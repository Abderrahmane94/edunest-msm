import { Request, Response, NextFunction } from 'express';
import { branchCalendarService, BranchCalendarServiceError } from './branch-calendar.service';
import { createBranchCalendarSchema } from './payments.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchFeeAccess } from './tenant-scope.middleware';
import { ZodError } from 'zod';

export const branchCalendarController = {
  /**
   * POST /api/payments/fees/:branchFeeId/calendar
   * Create a new BranchCalendar entry for this fee.
   * Requires academicYearId in the request body.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId } = req.params;

      // Validate fee access via its branch (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const { academicYearId, ...calendarData } = req.body;

      if (!academicYearId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Academic year ID is required', [
            { field: 'academicYearId', message: 'Academic year ID is required' },
          ]),
        );
        return;
      }

      const parsed = createBranchCalendarSchema.parse(calendarData);
      const entry = await branchCalendarService.create(branchFeeId, academicYearId, parsed);
      res.status(201).json(successResponse(entry));
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Request body validation failed', details));
        return;
      }
      if (error instanceof BranchCalendarServiceError) {
        if (error.details) {
          res.status(error.statusCode).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        } else {
          res.status(error.statusCode).json(errorResponse(error.code, error.message));
        }
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/payments/fees/:branchFeeId/calendar/:id
   * Update an existing BranchCalendar entry.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId, id } = req.params;

      // Validate fee access via its branch (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const parsed = createBranchCalendarSchema.parse(req.body);
      const entry = await branchCalendarService.update(id, branchFeeId, parsed);
      res.status(200).json(successResponse(entry));
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Request body validation failed', details));
        return;
      }
      if (error instanceof BranchCalendarServiceError) {
        if (error.details) {
          res.status(error.statusCode).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        } else {
          res.status(error.statusCode).json(errorResponse(error.code, error.message));
        }
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/payments/fees/:branchFeeId/calendar/:id
   * Delete a BranchCalendar entry.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId, id } = req.params;

      // Validate fee access via its branch (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      await branchCalendarService.delete(id, branchFeeId);
      res.status(200).json(successResponse({ message: 'Calendar entry deleted successfully' }));
    } catch (error) {
      if (error instanceof BranchCalendarServiceError) {
        if (error.details) {
          res.status(error.statusCode).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
        } else {
          res.status(error.statusCode).json(errorResponse(error.code, error.message));
        }
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/fees/:branchFeeId/calendar
   * List all BranchCalendar entries for a fee + academic year.
   * Requires academicYearId as a query parameter.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId } = req.params;

      // Validate fee access via its branch (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const academicYearId = req.query.academicYearId as string;

      if (!academicYearId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Academic year ID is required', [
            { field: 'academicYearId', message: 'academicYearId query parameter is required' },
          ]),
        );
        return;
      }

      const entries = await branchCalendarService.list(branchFeeId, academicYearId);
      res.status(200).json(successResponse(entries));
    } catch (error) {
      if (error instanceof BranchCalendarServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },
};
