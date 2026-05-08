import { Router } from 'express';
import { schoolsController } from './schools.controller';
import { requireSuperAdmin, requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createSchoolSchema, updateSchoolSchema } from './schools.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/schools — Create school (super_admin only)
router.post('/', requireSuperAdmin, validate(createSchoolSchema), schoolsController.create);

// GET /api/schools — List all schools (super_admin only)
router.get('/', requireSuperAdmin, schoolsController.list);

// GET /api/schools/:id — Get school by ID (admin, super_admin)
router.get('/:id', requireAdmin, validateParams(idParamSchema), schoolsController.getById);

// PUT /api/schools/:id — Update school (admin, super_admin)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateSchoolSchema), schoolsController.update);

// PATCH /api/schools/:id/deactivate — Deactivate school (super_admin only)
router.patch('/:id/deactivate', requireSuperAdmin, validateParams(idParamSchema), schoolsController.deactivate);

// POST /api/schools/:id/logo — Upload school logo (admin, super_admin)
router.post('/:id/logo', requireAdmin, validateParams(idParamSchema), schoolsController.uploadLogo);

export default router;
