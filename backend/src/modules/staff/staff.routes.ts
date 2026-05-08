import { Router } from 'express';
import { staffController } from './staff.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createStaffProfileSchema, updateStaffProfileSchema } from './staff.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/staff — Create staff profile (admin only)
router.post('/', requireAdmin, validate(createStaffProfileSchema), staffController.create);

// GET /api/staff — List staff profiles in school (admin only)
router.get('/', requireAdmin, staffController.list);

// GET /api/staff/:id — Get staff profile by ID (admin only)
router.get('/:id', requireAdmin, validateParams(idParamSchema), staffController.getById);

// PUT /api/staff/:id — Update staff profile (admin only)
router.put(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateStaffProfileSchema),
  staffController.update,
);

// POST /api/staff/:id/document — Upload staff document (admin only)
router.post('/:id/document', requireAdmin, validateParams(idParamSchema), staffController.uploadDocument);

// GET /api/staff/:id/document-url — Get signed URL for staff document (admin only)
router.get('/:id/document-url', requireAdmin, validateParams(idParamSchema), staffController.getDocumentUrl);

export default router;
