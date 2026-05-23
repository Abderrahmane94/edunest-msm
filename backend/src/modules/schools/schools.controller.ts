import { Request, Response, NextFunction } from 'express';
import { schoolsService, SchoolServiceError } from './schools.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateSchoolInput, UpdateSchoolInput } from './schools.schema';
import { paginationSchema } from '../../utils/validators';
import { usersService, UserServiceError } from '../users/users.service';
import { createUserDirectlySchema } from '../users/users.schema';
import { softDeleteService, SoftDeleteError } from '../../services/soft-delete.service';

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
   * PATCH /api/schools/:id/activate — Activate school (super_admin only)
   */
  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const school = await schoolsService.activate(id);
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
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { users, total } = await usersService.list(id, page, pageSize);
      res.status(200).json(paginatedResponse(users, page, pageSize, total));
    } catch (error) {
      next(error);
    }
  },

  async createUserInSchool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = createUserDirectlySchema.parse(req.body);
      const user = await usersService.createDirectly(id, input);
      res.status(201).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.file?.buffer) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Logo image file is required'));
        return;
      }

      const school = await schoolsService.uploadLogo(id, req.file.buffer);
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
   * DELETE /api/schools/:id — Soft delete school (super_admin only)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await softDeleteService.softDelete('school', id);
      res.status(200).json(successResponse({ message: 'School deleted successfully' }));
    } catch (error) {
      if (error instanceof SoftDeleteError) {
        const code = error.statusCode === 409 ? 'ALREADY_DELETED' : 'NOT_FOUND';
        res.status(error.statusCode).json(errorResponse(code, error.message));
        return;
      }
      next(error);
    }
  },
};
