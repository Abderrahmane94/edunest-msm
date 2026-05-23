import { Request, Response, NextFunction } from 'express';
import { classroomsService, ClassroomServiceError } from './classrooms.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateClassroomInput, UpdateClassroomInput, AssignTeacherInput } from './classrooms.schema';
import { paginationSchema } from '../../utils/validators';
import { softDeleteService, SoftDeleteError } from '../../services/soft-delete.service';

export const classroomsController = {
  /**
   * POST /api/classrooms — Create a new classroom
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const input = req.body as CreateClassroomInput;
      const classroom = await classroomsService.create(schoolId, input);
      res.status(201).json(successResponse(classroom));
    } catch (error) {
      if (error instanceof ClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse('CLASSROOM_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/classrooms — List classrooms for the school
   */
  /**
   * GET /api/classrooms — List classrooms for the school
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const teacherId = req.query.teacher_id as string | undefined;
      const { classrooms, total } = await classroomsService.list(schoolId, page, pageSize, teacherId);
      res.status(200).json(paginatedResponse(classrooms, page, pageSize, total));
    } catch (error) {
      if (error instanceof ClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse('CLASSROOM_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/classrooms/:id — Get classroom by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const classroom = await classroomsService.getById(id, schoolId);
      res.status(200).json(successResponse(classroom));
    } catch (error) {
      if (error instanceof ClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse('CLASSROOM_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/classrooms/:id — Update classroom
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const input = req.body as UpdateClassroomInput;
      const classroom = await classroomsService.update(id, schoolId, input);
      res.status(200).json(successResponse(classroom));
    } catch (error) {
      if (error instanceof ClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse('CLASSROOM_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/classrooms/:id/assign-teacher — Assign teacher to classroom
   */
  async assignTeacher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const input = req.body as AssignTeacherInput;
      const classroom = await classroomsService.assignTeacher(id, schoolId, input);
      res.status(200).json(successResponse(classroom));
    } catch (error) {
      if (error instanceof ClassroomServiceError) {
        res.status(error.statusCode).json(errorResponse('CLASSROOM_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/classrooms/:id — Soft delete classroom (admin only)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      await softDeleteService.softDelete('classroom', id, schoolId);
      res.status(200).json(successResponse({ message: 'Classroom deleted successfully' }));
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
