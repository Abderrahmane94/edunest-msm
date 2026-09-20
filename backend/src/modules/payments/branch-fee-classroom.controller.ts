import { Request, Response, NextFunction } from 'express';
import { branchFeeClassroomService, BranchFeeClassroomServiceError } from './branch-fee-classroom.service';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchFeeAccess, validateClassroomAccess } from './tenant-scope.middleware';

export const branchFeeClassroomController = {
  /**
   * GET /api/payments/fees/:branchFeeId/classrooms
   * List the fee's school classrooms, flagged with which are linked to this fee.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId } = req.params;

      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const result = await branchFeeClassroomService.listForFee(branchFeeId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof BranchFeeClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/payments/fees/:branchFeeId/classrooms
   * Body: { classroomIds: string[] }
   * Replaces this fee's classroom links.
   */
  async setClassrooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchFeeId } = req.params;

      const validatedBranch = await validateBranchFeeAccess(branchFeeId, req, res);
      if (!validatedBranch) return;

      const { classroomIds } = req.body;

      if (!Array.isArray(classroomIds)) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'classroomIds must be an array of classroom IDs'),
        );
        return;
      }

      const result = await branchFeeClassroomService.setClassrooms(branchFeeId, classroomIds);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof BranchFeeClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/classrooms/:classroomId/fees
   * List active fees applicable to a classroom (linked + general fees).
   */
  async listForClassroom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { classroomId } = req.params;

      const allowed = await validateClassroomAccess(classroomId, req, res);
      if (!allowed) return;

      const result = await branchFeeClassroomService.listFeesForClassroom(classroomId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof BranchFeeClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },
};
