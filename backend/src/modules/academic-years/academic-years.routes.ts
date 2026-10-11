import { Router } from 'express';
import { academicYearsController } from './academic-years.controller';
import { requirePermission, requireAnyOffice } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createAcademicYearSchema, updateAcademicYearSchema } from './academic-years.schema';
import { yearRolloverSchema } from './year-rollover.schema';
import { idParamSchema } from '../../utils/validators';
import { rejectClosedYear } from '../../middleware/closed-year.middleware';

const router = Router();

// POST /api/academic-years — Create academic year (admin only)
router.post('/', requirePermission('settings', 'edit'), validate(createAcademicYearSchema), academicYearsController.create);

// GET /api/academic-years — List academic years for school (admin only)
router.get('/', requireAnyOffice(), academicYearsController.list);

// GET /api/academic-years/:id — Get academic year by ID (admin only)
router.get('/:id', requireAnyOffice(), validateParams(idParamSchema), academicYearsController.getById);

// PUT /api/academic-years/:id — Update academic year (admin only)
router.put('/:id', requirePermission('settings', 'edit'), validateParams(idParamSchema), validate(updateAcademicYearSchema), academicYearsController.update);

// DELETE /api/academic-years/:id — Delete academic year (admin only)
router.delete('/:id', requirePermission('settings', 'edit'), validateParams(idParamSchema), academicYearsController.delete);

// PATCH /api/academic-years/:id/activate — Activate academic year (admin only)
router.patch('/:id/activate', requirePermission('settings', 'edit'), validateParams(idParamSchema), academicYearsController.activate);

// PATCH /api/academic-years/:id/deactivate — Deactivate academic year (admin only)
router.patch('/:id/deactivate', requirePermission('settings', 'edit'), validateParams(idParamSchema), academicYearsController.deactivate);

// GET /api/academic-years/:id/rollover — Preview of preparing this year from another (admin only)
router.get('/:id/rollover', requirePermission('settings', 'view'), validateParams(idParamSchema), academicYearsController.rolloverPreview);

// POST /api/academic-years/:id/rollover — Prepare this year from another (admin only)
router.post('/:id/rollover', requirePermission('settings', 'edit'), validateParams(idParamSchema), validate(yearRolloverSchema), rejectClosedYear((req) => req.params.id), academicYearsController.rollover);

export default router;
