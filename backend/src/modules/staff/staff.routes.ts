import { Router } from 'express';
import multer from 'multer';
import { staffController } from './staff.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createStaffProfileSchema, updateStaffProfileSchema } from './staff.schema';
import { idParamSchema, uuidSchema } from '../../utils/validators';
import { z } from 'zod';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

const userIdParamSchema = z.object({ userId: uuidSchema });

const router = Router();

// POST /api/staff — Create staff profile (admin only)
router.post('/', requirePermission('staff', 'edit'), validate(createStaffProfileSchema), staffController.create);

// GET /api/staff — List staff profiles in school (admin only)
router.get('/', requirePermission('staff', 'view'), staffController.list);

// GET /api/staff/by-user/:userId — Get staff profile by linked user ID (admin only)
router.get('/by-user/:userId', requirePermission('staff', 'view'), validateParams(userIdParamSchema), staffController.getByUserId);

// GET /api/staff/:id — Get staff profile by ID (admin only)
router.get('/:id', requirePermission('staff', 'view'), validateParams(idParamSchema), staffController.getById);

// PUT /api/staff/:id — Update staff profile (admin only)
router.put(
  '/:id',
  requirePermission('staff', 'edit'),
  validateParams(idParamSchema),
  validate(updateStaffProfileSchema),
  staffController.update,
);

// POST /api/staff/:id/document — Upload staff document (admin only)
router.post(
  '/:id/document',
  requirePermission('staff', 'edit'),
  validateParams(idParamSchema),
  upload.single('document'),
  staffController.uploadDocument,
);

// GET /api/staff/:id/document-url — Get signed URL for staff document (admin only)
router.get('/:id/document-url', requirePermission('staff', 'view'), validateParams(idParamSchema), staffController.getDocumentUrl);

// DELETE /api/staff/:id/document — Delete staff document (admin only)
router.delete('/:id/document', requirePermission('staff', 'edit'), validateParams(idParamSchema), staffController.deleteDocument);

export default router;
