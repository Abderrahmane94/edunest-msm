import { Request, Response, NextFunction } from 'express';
import { roomsService, RoomServiceError } from './rooms.service';
import { successResponse, errorResponse } from '../../utils/response';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schema';

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof RoomServiceError) {
    res.status(error.statusCode).json(errorResponse('ROOM_ERROR', error.message));
    return;
  }
  next(error);
}

export const roomsController = {
  /**
   * GET /api/rooms — The school's rooms with their classes (of `academic_year_id` when given)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academicYearId =
        typeof req.query.academic_year_id === 'string' && req.query.academic_year_id
          ? req.query.academic_year_id
          : undefined;
      const rooms = await roomsService.list(req.user!.schoolId!, academicYearId);
      res.status(200).json(successResponse(rooms));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /**
   * POST /api/rooms — Add a room
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await roomsService.create(req.user!.schoolId!, req.body as CreateRoomInput);
      res.status(201).json(successResponse(room));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /**
   * PUT /api/rooms/:id — Change a room, or (de)activate it
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const room = await roomsService.update(req.params.id, req.user!.schoolId!, req.body as UpdateRoomInput);
      res.status(200).json(successResponse(room));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /**
   * DELETE /api/rooms/:id — Delete a room no class uses
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roomsService.delete(req.params.id, req.user!.schoolId!);
      res.status(200).json(successResponse({ message: 'Room deleted successfully' }));
    } catch (error) {
      handleError(error, res, next);
    }
  },
};
