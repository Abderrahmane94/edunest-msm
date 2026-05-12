import { Request, Response, NextFunction } from 'express';
import { usersService, UserServiceError } from './users.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import { paginationSchema } from '../../utils/validators';
import type { InviteUserInput, RegisterUserInput, UpdateFcmTokenInput, UpdateLanguageInput, UpdateUserInput, CreateUserDirectlyInput } from './users.schema';

export const usersController = {
  /**
   * POST /api/users/invite — Send invitation email (admin only)
   */
  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as InviteUserInput;
      const schoolId = req.user!.schoolId;
      const result = await usersService.invite(input.email, input.role as any, schoolId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/users/register — Complete registration via invitation token (public)
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as RegisterUserInput;
      const user = await usersService.register(
        input.token,
        input.firstName,
        input.lastName,
        input.password,
      );
      res.status(201).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/users — List users in school (admin only)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { users, total } = await usersService.list(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(users, page, pageSize, total));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/users/:id — Get user by ID (admin only)
   * super_admin can view any user; admin is scoped to their school.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.role === 'super_admin' ? null : req.user!.schoolId;
      const user = await usersService.getById(id, schoolId);
      res.status(200).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/users — Create a user directly in the admin's school (admin only)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const input = req.body as CreateUserDirectlyInput;
      const user = await usersService.createDirectly(schoolId, input);
      res.status(201).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/users/:id — Update user profile (admin only)
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.role === 'super_admin' ? null : req.user!.schoolId;
      const input = req.body as UpdateUserInput;
      const user = await usersService.update(id, schoolId, input as any);
      res.status(200).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/users/:id/activate — Activate user (admin only)
   */
  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.schoolId;
      const user = await usersService.activate(id, schoolId);
      res.status(200).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/users/:id/deactivate — Deactivate user (admin only)
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const schoolId = req.user!.schoolId;
      const user = await usersService.deactivate(id, schoolId);
      res.status(200).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/users/:id/fcm-token — Update FCM token (authenticated user)
   */
  async updateFcmToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUserId = req.user!.userId;

      // Users can only update their own FCM token
      if (id !== requestingUserId) {
        res.status(403).json(errorResponse('FORBIDDEN', 'You can only update your own FCM token'));
        return;
      }

      const input = req.body as UpdateFcmTokenInput;
      const user = await usersService.updateFcmToken(id, input.fcmToken);
      res.status(200).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/users/:id/language — Update preferred language (authenticated user)
   */
  async updateLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUserId = req.user!.userId;

      // Users can only update their own language preference
      if (id !== requestingUserId) {
        res.status(403).json(errorResponse('FORBIDDEN', 'You can only update your own language preference'));
        return;
      }

      const input = req.body as UpdateLanguageInput;
      const user = await usersService.updateLanguage(id, input.preferredLanguage as any);
      res.status(200).json(successResponse(user));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
