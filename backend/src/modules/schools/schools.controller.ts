import { Request, Response, NextFunction } from 'express';
import { schoolsService, SchoolServiceError } from './schools.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateSchoolInput, UpdateSchoolInput } from './schools.schema';
import { paginationSchema } from '../../utils/validators';

export const schoolsController = {
  /**
   * POST /api/schools — Create a new school (super_admin only)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as CreateSchoolInput;
      const school = await schoolsService.create(input);
      res.status(201).json(successResponse(school));
    } catch (error) {
      if (error instanceof SchoolServiceError) {
        res.status(error.statusCode).json(errorResponse('SCHOOL_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/schools — List all schools (super_admin only)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { schools, total } = await schoolsService.list(page, pageSize);
      res.status(200).json(paginatedResponse(schools, page, pageSize, total));
    } catch (error) {
      if (error instanceof SchoolServiceError) {
        res.status(error.statusCode).json(errorResponse('SCHOOL_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/schools/:id — Get school by ID (admin, super_admin)
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const school = await schoolsService.getById(id);
      res.status(200).json(successResponse(school));
    } catch (error) {
      if (error instanceof SchoolServiceError) {
        res.status(error.statusCode).json(errorResponse('SCHOOL_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/schools/:id — Update school (admin, super_admin)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = req.body as UpdateSchoolInput;
      const school = await schoolsService.update(id, input);
      res.status(200).json(successResponse(school));
    } catch (error) {
      if (error instanceof SchoolServiceError) {
        res.status(error.statusCode).json(errorResponse('SCHOOL_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/schools/:id/deactivate — Deactivate school (super_admin only)
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const school = await schoolsService.deactivate(id);
      res.status(200).json(successResponse(school));
    } catch (error) {
      if (error instanceof SchoolServiceError) {
        res.status(error.statusCode).json(errorResponse('SCHOOL_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/schools/:id/logo — Upload school logo (admin, super_admin)
   */
  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Expect raw body buffer or base64 encoded file in body
      if (!req.body || !req.body.file) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'File is required in request body'));
        return;
      }

      const fileBuffer = Buffer.isBuffer(req.body.file)
        ? req.body.file
        : Buffer.from(req.body.file, 'base64');

      const school = await schoolsService.uploadLogo(id, fileBuffer);
      res.status(200).json(successResponse(school));
    } catch (error) {
      if (error instanceof SchoolServiceError) {
        res.status(error.statusCode).json(errorResponse('SCHOOL_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
