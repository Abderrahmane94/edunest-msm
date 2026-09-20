import { Request, Response, NextFunction } from 'express';
import { branchFeePeriodService, BranchFeePeriodServiceError } from './branch-fee-period.service';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchFeeAccess } from './tenant-scope.middleware';

export const branchFeePeriodController = {
  /**
   * GET /api/payments/fees/:branchFeeId/periods?academicYearId=X
   * List the branch's periods for that year, flagged with which are
   * assigned to this fee.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId } = req.params;

      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const academicYearId = req.query.academicYearId as string;
      if (!academicYearId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'academicYearId query parameter is required'),
        );
        return;
      }

      const result = await branchFeePeriodService.listForFee(branchFeeId, academicYearId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof BranchFeePeriodServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/payments/fees/:branchFeeId/periods
   * Body: { academicYearId, periodIds: string[] }
   * Replaces this fee's period assignments for that academic year.
   */
  async setAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId } = req.params;

      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const { academicYearId, periodIds } = req.body;

      if (!academicYearId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'academicYearId is required'),
        );
        return;
      }

      if (!Array.isArray(periodIds)) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'periodIds must be an array of period IDs'),
        );
        return;
      }

      const result = await branchFeePeriodService.setAssignments(branchFeeId, academicYearId, periodIds);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof BranchFeePeriodServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },
};
