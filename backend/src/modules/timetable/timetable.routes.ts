import { Router } from 'express';
import { timetableController } from './timetable.controller';
import { requireAdmin, requireTeacherOrAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { updateWorkingDaysSchema, classroomIdParamSchema } from './timetable.schema';

const router = Router();

// GET /api/timetable/:classroomId — Get working days (admin or teacher)
router.get('/:classroomId', requireTeacherOrAdmin, validateParams(classroomIdParamSchema), timetableController.getWorkingDays);

// PUT /api/timetable — Update working days (admin only)
router.put('/', requireAdmin, validate(updateWorkingDaysSchema), timetableController.updateWorkingDays);

export default router;
