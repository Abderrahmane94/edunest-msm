import { Router } from 'express';
import { academicYearsController } from './academic-years.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createAcademicYearSchema, updateAcademicYearSchema } from './academic-years.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/academic-years — Create academic year (admin only)
router.post('/', requireAdmin, validate(createAcademicYearSchema), academicYearsController.create);

// GET /api/academic-years — List academic years for school (admin only)
router.get('/', requireAdmin, academicYearsController.list);

// GET /api/academic-years/:id — Get academic year by ID (admin only)
router.get('/:id', requireAdmin, validateParams(idParamSchema), academicYearsController.getById);

// PUT /api/academic-years/:id — Update academic year (admin only)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateAcademicYearSchema), academicYearsController.update);

// DELETE /api/academic-years/:id — Delete academic year (admin only)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), academicYearsController.delete);

// PATCH /api/academic-years/:id/activate — Activate academic year (admin only)
router.patch('/:id/activate', requireAdmin, validateParams(idParamSchema), academicYearsController.activate);

// PATCH /api/academic-years/:id/deactivate — Deactivate academic year (admin only)
router.patch('/:id/deactivate', requireAdmin, validateParams(idParamSchema), academicYearsController.deactivate);

export default router;
