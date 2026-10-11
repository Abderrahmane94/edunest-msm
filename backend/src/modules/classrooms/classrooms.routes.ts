import { Router } from 'express';
import { classroomsController } from './classrooms.controller';
import { requireAdmin, requireOffice, requireTeacherOrOffice } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createClassroomSchema, updateClassroomSchema, assignTeacherSchema } from './classrooms.schema';
import { idParamSchema } from '../../utils/validators';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// POST /api/classrooms — Create classroom (admin only)
router.post('/', requireOffice, validate(createClassroomSchema), rejectClosedYear(yearOf.body()), classroomsController.create);

// GET /api/classrooms — List classrooms for school (admin or teacher)
router.get('/', requireTeacherOrOffice, classroomsController.list);

// GET /api/classrooms/:id — Get classroom by ID (admin or teacher)
router.get('/:id', requireTeacherOrOffice, validateParams(idParamSchema), classroomsController.getById);

// PUT /api/classrooms/:id — Update classroom (admin only)
router.put('/:id', requireOffice, validateParams(idParamSchema), validate(updateClassroomSchema), rejectClosedYear((req) => yearOf.classroom(req.params.id)), classroomsController.update);

// PATCH /api/classrooms/:id/assign-teacher — Assign teacher (admin only)
router.patch('/:id/assign-teacher', requireOffice, validateParams(idParamSchema), validate(assignTeacherSchema), rejectClosedYear((req) => yearOf.classroom(req.params.id)), classroomsController.assignTeacher);

// DELETE /api/classrooms/:id — Delete classroom (admin only, only if no enrollments)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), rejectClosedYear((req) => yearOf.classroom(req.params.id)), classroomsController.delete);

export default router;
