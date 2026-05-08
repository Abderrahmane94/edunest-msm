import { Request, Response, NextFunction } from 'express';
import { staffService, StaffServiceError } from './staff.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import { paginationSchema } from '../../utils/validators';
import type { CreateStaffProfileInput, UpdateStaffProfileInput } from './staff.schema';

export const staffController = {
  /**
   * POST /api/staff — Create a staff profile (admin only)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as CreateStaffProfileInput;
      const schoolId = req.user!.schoolId;

      const profile = await staffService.create(
        schoolId,
        input.userId,
        input.position,
        input.contractType as any,
        input.contractStart,
        input.contractEnd,
      );

      res.status(201).json(successResponse(profile));
    } catch (error) {
      if (error instanceof StaffServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/staff — List staff profiles in school (admin only)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { profiles, total } = await staffService.list(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(profiles, page, pageSize, total));
    } catch (error) {
      if (error instanceof StaffServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/staff/:id — Get staff profile by ID (admin only)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.schoolId;
      const profile = await staffService.getById(id, schoolId);
      res.status(200).json(successResponse(profile));
    } catch (error) {
      if (error instanceof StaffServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/staff/:id — Update staff profile (admin only)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.schoolId;
      const input = req.body as UpdateStaffProfileInput;

      const profile = await staffService.update(id, schoolId, {
        position: input.position,
        contractType: input.contractType as any,
        contractStart: input.contractStart,
        contractEnd: input.contractEnd,
      });

      res.status(200).json(successResponse(profile));
    } catch (error) {
      if (error instanceof StaffServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/staff/:id/document — Upload staff document (admin only)
   */
  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.schoolId;

      if (!req.body || !Buffer.isBuffer(req.body)) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Request body must contain a file buffer'));
        return;
      }

      const profile = await staffService.uploadDocument(id, schoolId, req.body);
      res.status(200).json(successResponse(profile));
    } catch (error) {
      if (error instanceof StaffServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/staff/:id/document-url — Get signed URL for staff document (admin only)
   */
  async getDocumentUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.schoolId;
      const result = await staffService.getDocumentUrl(id, schoolId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof StaffServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
