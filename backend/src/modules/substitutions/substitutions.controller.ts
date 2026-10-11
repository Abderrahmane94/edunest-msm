import { Request, Response, NextFunction } from 'express';
import { substitutionsService, SubstitutionServiceError } from './substitutions.service';
import { successResponse, errorResponse } from '../../utils/response';
import type { CreateSubstitutionInput, UpdateSubstitutionInput } from './substitutions.schema';

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof SubstitutionServiceError) {
    res.status(error.statusCode).json(errorResponse(error.code, error.message));
    return;
  }
  next(error);
}

const query = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export const substitutionsController = {
  /** GET /api/substitutions — Replacements (?classroom_id, ?user_id, ?on=YYYY-MM-DD, ?all=true) */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await substitutionsService.list(req.user!.schoolId!, {
        classroomId: query(req.query.classroom_id),
        userId: query(req.query.user_id),
        on: query(req.query.on),
        includeCancelled: req.query.all === 'true',
      });
      res.status(200).json(successResponse(list));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** GET /api/substitutions/my-classes — The classes a teacher works with today */
  async myClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await substitutionsService.myClasses(req.user!.userId, req.user!.schoolId!)));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** POST /api/substitutions — Record a replacement */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await substitutionsService.create(req.user!.schoolId!, req.user!.userId, req.body as CreateSubstitutionInput);
      res.status(201).json(successResponse(result));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** PUT /api/substitutions/:id — Change the substitute, the dates or the reason */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const s = await substitutionsService.update(req.params.id, req.user!.schoolId!, req.body as UpdateSubstitutionInput);
      res.status(200).json(successResponse(s));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** POST /api/substitutions/:id/end — The teacher is back: ends today */
  async endToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await substitutionsService.endToday(req.params.id, req.user!.schoolId!)));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** DELETE /api/substitutions/:id — Cancel a replacement */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await substitutionsService.cancel(req.params.id, req.user!.schoolId!)));
    } catch (error) {
      handleError(error, res, next);
    }
  },
};
