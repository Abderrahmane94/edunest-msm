import { Request, Response, NextFunction } from 'express';
import { profileService } from './profile.service';
import { UserServiceError } from './users.service';
import { successResponse, errorResponse } from '../../utils/response';
import type { UpdateMyProfileInput } from './users.schema';

/** "Mon profil": always the signed-in account, never another one. */
function handle(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(successResponse(await fn(req)));
    } catch (error) {
      if (error instanceof UserServiceError) {
        res.status(error.statusCode).json(errorResponse('USER_ERROR', error.message));
        return;
      }
      next(error);
    }
  };
}

export const profileController = {
  get: handle((req) => profileService.get(req.user!.userId)),

  update: handle((req) => profileService.update(req.user!.userId, req.body as UpdateMyProfileInput)),

  async setAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.file) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Photo file is required'));
      return;
    }
    const file = req.file;
    return handle((r) => profileService.setAvatar(r.user!.userId, r.user!.schoolId ?? null, file.buffer, file.mimetype))(req, res, next);
  },

  removeAvatar: handle((req) => profileService.removeAvatar(req.user!.userId)),
};
