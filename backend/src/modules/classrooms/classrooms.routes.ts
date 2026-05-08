import { Router } from 'express';
import { classroomsController } from './classrooms.controller';
import { requireAdmin, requireTeacherOrAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createClassroomSchema, updateClassroomSchema, assignTeacherSchema } from './classrooms.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/classrooms — Create classroom (admin only)
router.post('/', requireAdmin, validate(createClassroomSchema), classroomsController.create);

// GET /api/classrooms — List classrooms for school (admin or teacher)
router.get('/', requireTeacherOrAdmin, classroomsController.list);

// GET /api/classrooms/:id — Get classroom by ID (admin or teacher)
router.get('/:id', requireTeacherOrAdmin, validateParams(idParamSchema), classroomsController.getById);

// PUT /api/classrooms/:id — Update classroom (admin only)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateClassroomSchema), classroomsController.update);

// PATCH /api/classrooms/:id/assign-teacher — Assign teacher (admin only)
router.patch('/:id/assign-teacher', requireAdmin, validateParams(idParamSchema), validate(assignTeacherSchema), classroomsController.assignTeacher);

// DELETE /api/classrooms/:id — Delete classroom (admin only, only if no enrollments)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), classroomsController.delete);

export default router;
