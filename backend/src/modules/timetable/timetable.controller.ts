import { Request, Response, NextFunction } from 'express';
import { timetableService, TimetableServiceError } from './timetable.service';
import { successResponse, errorResponse } from '../../utils/response';
import type { UpdateWorkingDaysInput } from './timetable.schema';

export const timetableController = {
  /**
   * GET /api/timetable/:classroomId — Get working days for a classroom
   */
  async getWorkingDays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { classroomId } = req.params;
      const requestingTeacherUserId = req.user!.role === 'teacher' ? req.user!.userId : undefined;
      const result = await timetableService.getWorkingDays(classroomId, schoolId, requestingTeacherUserId);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof TimetableServiceError) {
        res.status(error.statusCode).json(errorResponse('TIMETABLE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/timetable — Update working days for a classroom
   */
  async updateWorkingDays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const input = req.body as UpdateWorkingDaysInput;
      const result = await timetableService.updateWorkingDays(schoolId, input);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof TimetableServiceError) {
        res.status(error.statusCode).json(errorResponse('TIMETABLE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
