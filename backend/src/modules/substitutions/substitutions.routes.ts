import { Router } from 'express';
import { substitutionsController } from './substitutions.controller';
import { rbac, requireOffice } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';
import { createSubstitutionSchema, updateSubstitutionSchema } from './substitutions.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// GET /api/substitutions/my-classes — The classes a teacher works with today (teacher)
router.get('/my-classes', rbac(['teacher']), substitutionsController.myClasses);

// GET /api/substitutions — Replacements of a class, of a teacher, or in force on a day (office)
router.get('/', requireOffice, substitutionsController.list);

// POST /api/substitutions — Record a replacement, today or planned (office)
router.post(
  '/',
  requireOffice,
  validate(createSubstitutionSchema),
  rejectClosedYear((req) => yearOf.classroom((req.body as { classroomId: string }).classroomId)),
  substitutionsController.create,
);

// PUT /api/substitutions/:id — Change it (office)
router.put(
  '/:id',
  requireOffice,
  validateParams(idParamSchema),
  validate(updateSubstitutionSchema),
  rejectClosedYear((req) => yearOf.substitution(req.params.id)),
  substitutionsController.update,
);

// POST /api/substitutions/:id/end — The teacher is back, ends today (office)
router.post('/:id/end', requireOffice, validateParams(idParamSchema), rejectClosedYear((req) => yearOf.substitution(req.params.id)), substitutionsController.endToday);

// DELETE /api/substitutions/:id — Cancel it (office)
router.delete('/:id', requireOffice, validateParams(idParamSchema), rejectClosedYear((req) => yearOf.substitution(req.params.id)), substitutionsController.cancel);

export default router;
