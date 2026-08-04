import { Request, Response, NextFunction } from 'express';
import { enrollmentService, EnrollmentServiceError } from './enrollment.service';
import { createEnrollmentSchema, withdrawEnrollmentSchema } from './payments.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchAccess, validateEnrollmentAccess, resolveBranchFilter } from './tenant-scope.middleware';
import { ZodError } from 'zod';

/** Roles considered "Staff" for enrollment access. */
const STAFF_ROLES = ['admin', 'super_admin'] as const;

export const enrollmentController = {
  /**
   * POST /api/payments/enrollments
   * Create a new enrollment with auto-generated billing periods.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      // Validate request body
      const parsed = createEnrollmentSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = mapZodErrors(parsed.error);
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }

      // Validate branch access for the enrollment's branchId (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(parsed.data.branchId, req, res);
      if (!validatedBranch) return;

      const result = await enrollmentService.create(parsed.data, req.user.userId);
      res.status(201).json(successResponse(result));
    } catch (error) {
      if (error instanceof EnrollmentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/enrollments
   * List enrollments for a branch (requires branchId query param).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const requestedBranchId = req.query.branchId as string | undefined;

      // Resolve branch filter based on tenant scope (Req 20.2, 20.3)
      const branchFilter = await resolveBranchFilter(requestedBranchId, req, res);
      if (!branchFilter) return;

      // If no branchId resolved at all, require explicit branchId
      if (!branchFilter.branchId && !branchFilter.branchIds) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'branchId query parameter is required'),
        );
        return;
      }

      const filters: { academicYearId?: string } = {};
      if (req.query.academicYearId) {
        filters.academicYearId = req.query.academicYearId as string;
      }

      // Single branch or multiple branches (school-wide staff)
      if (branchFilter.branchId) {
        const enrollments = await enrollmentService.list(branchFilter.branchId, filters);
        res.status(200).json(successResponse(enrollments));
      } else if (branchFilter.branchIds && branchFilter.branchIds.length > 0) {
        // School-wide staff: list enrollments across all branches (Req 20.3)
        const allEnrollments = await enrollmentService.listMultipleBranches(
          branchFilter.branchIds,
          filters,
        );
        res.status(200).json(successResponse(allEnrollments));
      } else {
        // No branches exist for the school — return empty list
        res.status(200).json(successResponse([]));
      }
    } catch (error) {
      if (error instanceof EnrollmentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/enrollments/:id
   * Get a single enrollment with billing periods.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { id } = req.params;

      // Validate enrollment access (Req 20.1, 20.6, 20.7)
      const validatedBranch = await validateEnrollmentAccess(id, req, res);
      if (!validatedBranch) return;

      const enrollment = await enrollmentService.get(id);
      res.status(200).json(successResponse(enrollment));
    } catch (error) {
      if (error instanceof EnrollmentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/payments/enrollments/:id
   * Update enrollment fields (status, fees).
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { id } = req.params;

      // Validate enrollment access (Req 20.1, 20.6, 20.7)
      const validatedBranch = await validateEnrollmentAccess(id, req, res);
      if (!validatedBranch) return;

      const data = req.body;

      const result = await enrollmentService.update(id, data);
      res.status(200).json(
        successResponse({
          ...result.enrollment,
          unchangedPeriodsCount: result.unchangedPeriodsCount,
        }),
      );
    } catch (error) {
      if (error instanceof EnrollmentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/payments/enrollments/:id/withdraw
   * Withdraw an enrollment (cancels future billing periods).
   */
  async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { id } = req.params;

      // Validate enrollment access (Req 20.1, 20.6, 20.7)
      const validatedBranch = await validateEnrollmentAccess(id, req, res);
      if (!validatedBranch) return;

      // Validate request body
      const parsed = withdrawEnrollmentSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = mapZodErrors(parsed.error);
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }

      const result = await (enrollmentService as any).withdraw(id, parsed.data);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof EnrollmentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },
};

/**
 * Map Zod validation errors to the standard FieldError[] format.
 */
function mapZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
