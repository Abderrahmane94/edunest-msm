import { Request, Response, NextFunction } from 'express';
import { branchCalendarService, BranchCalendarServiceError } from './branch-calendar.service';
import { createBranchCalendarSchema } from './payments.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchAccess } from './tenant-scope.middleware';
import { ZodError } from 'zod';

export const branchCalendarController = {
  /**
   * POST /api/payments/branches/:branchId/calendar
   * Create a new BranchCalendar entry.
   * Requires academicYearId in the request body.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId } = req.params;

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
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
      const entry = await branchCalendarService.create(validatedBranch, academicYearId, parsed);
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
   * PUT /api/payments/branches/:branchId/calendar/:id
   * Update an existing BranchCalendar entry.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId, id } = req.params;

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      const parsed = createBranchCalendarSchema.parse(req.body);
      const entry = await branchCalendarService.update(id, validatedBranch, parsed);
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
   * DELETE /api/payments/branches/:branchId/calendar/:id
   * Delete a BranchCalendar entry.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId, id } = req.params;

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      await branchCalendarService.delete(id, validatedBranch);
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
   * GET /api/payments/branches/:branchId/calendar
   * List all BranchCalendar entries for a branch + academic year.
   * Requires academicYearId as a query parameter.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId } = req.params;

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
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

      const entries = await branchCalendarService.list(validatedBranch, academicYearId);
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
