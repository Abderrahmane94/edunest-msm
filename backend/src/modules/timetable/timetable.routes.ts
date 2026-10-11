import { Router } from 'express';
import { timetableController } from './timetable.controller';
import { requirePermission, requireAnyOffice } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { updateWorkingDaysSchema, classroomIdParamSchema } from './timetable.schema';

const router = Router();

// GET /api/timetable/:classroomId — Get working days (admin or teacher)
router.get('/:classroomId', requireAnyOffice({ alsoRoles: ['teacher'] }), validateParams(classroomIdParamSchema), timetableController.getWorkingDays);

// PUT /api/timetable — Update working days (admin only)
router.put('/', requirePermission('settings', 'edit'), validate(updateWorkingDaysSchema), timetableController.updateWorkingDays);

export default router;
