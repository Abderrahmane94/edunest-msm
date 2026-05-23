import { Request, Response, NextFunction } from 'express';
import { attendanceService, AttendanceServiceError } from './attendance.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { BulkMarkAttendanceInput, UpdateAttendanceInput, AttendanceReportQuery, ClassroomAttendanceQuery, ChildAttendanceQuery, ParentChildrenMonthQuery } from './attendance.schema';

export const attendanceController = {
  /**
   * POST /api/attendance/bulk-mark — Bulk mark attendance for a classroom
   */
  async bulkMark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const input = req.body as BulkMarkAttendanceInput;

      const records = await attendanceService.bulkMark(schoolId, userId, userRole, input);
      res.status(201).json(successResponse(records));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/attendance/:id — Update a single attendance record
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const input = req.body as UpdateAttendanceInput;

      const record = await attendanceService.update(id, schoolId, userId, userRole, input);
      res.status(200).json(successResponse(record));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/classroom/:classroomId — Get attendance for a classroom on a date
   */
  async getByClassroom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { classroomId } = req.params;
      const { date } = req.query as unknown as ClassroomAttendanceQuery;

      const records = await attendanceService.getByClassroom(
        classroomId,
        schoolId,
        userId,
        userRole,
        date,
      );
      res.status(200).json(successResponse(records));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/child/:childId — Get attendance history for a child
   */
  async getByChild(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { childId } = req.params;
      const { startDate, endDate, page, pageSize } = req.query as unknown as ChildAttendanceQuery;

      const { records, total } = await attendanceService.getByChild(
        childId,
        schoolId,
        userId,
        userRole,
        { startDate, endDate, page, pageSize },
      );
      res.status(200).json(paginatedResponse(records, page, pageSize, total));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/report/classroom/:classroomId — Monthly classroom attendance report (admin only)
   */
  async getClassroomReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { classroomId } = req.params;
      const { month, year } = req.query as unknown as AttendanceReportQuery;

      const report = await attendanceService.getClassroomMonthlyReport(
        classroomId,
        schoolId,
        month,
        year,
      );
      res.status(200).json(successResponse(report));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/report/child/:childId — Monthly child attendance summary (admin, teacher, parent)
   */
  async getChildReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { childId } = req.params;
      const { month, year } = req.query as unknown as AttendanceReportQuery;

      const summary = await attendanceService.getChildMonthlySummary(
        childId,
        schoolId,
        userId,
        userRole,
        month,
        year,
      );
      res.status(200).json(successResponse(summary));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/my-children?month=YYYY-MM — Parent's children monthly attendance summary
   */
  async getMyChildrenAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { month } = req.query as unknown as ParentChildrenMonthQuery;

      const result = await attendanceService.getParentChildrenAttendance(userId, schoolId, month);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/tracking — Get marking status for all classrooms in a date range (admin only)
   */
  async getMarkingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      if (!startDate || !endDate) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'start_date and end_date are required'));
        return;
      }

      const result = await attendanceService.getMarkingStatus(schoolId, startDate, endDate);
      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof AttendanceServiceError) {
        res.status(error.statusCode).json(errorResponse('ATTENDANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
