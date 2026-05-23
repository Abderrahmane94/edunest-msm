import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { requireTeacherOrAdmin, requireActiveRole, requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams, validateQuery } from '../../middleware/validation.middleware';
import {
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  classroomIdParamSchema,
  childIdParamSchema,
  classroomAttendanceQuerySchema,
  childAttendanceQuerySchema,
  attendanceReportQuerySchema,
  parentChildrenMonthQuerySchema,
} from './attendance.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/attendance/bulk-mark — Bulk mark attendance (teacher or admin)
router.post(
  '/bulk-mark',
  requireTeacherOrAdmin,
  validate(bulkMarkAttendanceSchema),
  attendanceController.bulkMark,
);

// GET /api/attendance/tracking — Get marking status for all classrooms (admin only)
router.get(
  '/tracking',
  requireAdmin,
  attendanceController.getMarkingStatus,
);

// GET /api/attendance/my-children?month=YYYY-MM — Parent's children monthly attendance summary
router.get(
  '/my-children',
  requireActiveRole,
  validateQuery(parentChildrenMonthQuerySchema),
  attendanceController.getMyChildrenAttendance,
);

// PATCH /api/attendance/:id — Update a single attendance record (teacher or admin)
router.patch(
  '/:id',
  requireTeacherOrAdmin,
  validateParams(idParamSchema),
  validate(updateAttendanceSchema),
  attendanceController.update,
);

// GET /api/attendance/report/classroom/:classroomId — Monthly classroom attendance report (admin only)
router.get(
  '/report/classroom/:classroomId',
  requireAdmin,
  validateParams(classroomIdParamSchema),
  validateQuery(attendanceReportQuerySchema),
  attendanceController.getClassroomReport,
);

// GET /api/attendance/report/child/:childId — Monthly child attendance summary (admin, teacher, parent)
router.get(
  '/report/child/:childId',
  requireActiveRole,
  validateParams(childIdParamSchema),
  validateQuery(attendanceReportQuerySchema),
  attendanceController.getChildReport,
);

// GET /api/attendance/classroom/:classroomId — Get attendance for a classroom on a date (teacher or admin)
router.get(
  '/classroom/:classroomId',
  requireTeacherOrAdmin,
  validateParams(classroomIdParamSchema),
  validateQuery(classroomAttendanceQuerySchema),
  attendanceController.getByClassroom,
);

// GET /api/attendance/child/:childId — Get attendance history for a child (teacher, admin, or parent)
router.get(
  '/child/:childId',
  requireActiveRole,
  validateParams(childIdParamSchema),
  validateQuery(childAttendanceQuerySchema),
  attendanceController.getByChild,
);

export default router;
