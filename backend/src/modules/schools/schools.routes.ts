import { Router } from 'express';
import multer from 'multer';
import { schoolsController } from './schools.controller';
import { requireSuperAdmin } from '../../middleware/rbac.middleware';
import { requirePermission, requireAnyOffice } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createSchoolSchema, extendTrialSchema, purgeSchoolSchema, updateSchoolSchema } from './schools.schema';
import { idParamSchema } from '../../utils/validators';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

const router = Router();

// POST /api/schools — Create school (super_admin only)
router.post('/', requireSuperAdmin, validate(createSchoolSchema), schoolsController.create);

// GET /api/schools — List all schools (super_admin only)
router.get('/', requireSuperAdmin, schoolsController.list);

// GET /api/schools/mine/brand — Name and logo of the user's own school (any member)
router.get('/mine/brand', schoolsController.brand);

// GET /api/schools/:id — Get school by ID (admin, super_admin)
router.get('/:id', requireAnyOffice(), validateParams(idParamSchema), schoolsController.getById);

// PUT /api/schools/:id — Update school (admin, super_admin)
router.put('/:id', requirePermission('settings', 'edit'), validateParams(idParamSchema), validate(updateSchoolSchema), schoolsController.update);

// PATCH /api/schools/:id/activate — Activate school (super_admin only)
router.patch('/:id/activate', requireSuperAdmin, validateParams(idParamSchema), schoolsController.activate);

// PATCH /api/schools/:id/deactivate — Deactivate school (super_admin only)
router.patch('/:id/deactivate', requireSuperAdmin, validateParams(idParamSchema), schoolsController.deactivate);

// GET /api/schools/:id/users — List users for a school (super_admin only)
router.get('/:id/users', requireSuperAdmin, validateParams(idParamSchema), schoolsController.listUsers);

// POST /api/schools/:id/users — Create a user directly in a specific school (super_admin only)
router.post('/:id/users', requireSuperAdmin, validateParams(idParamSchema), schoolsController.createUserInSchool);

// POST /api/schools/:id/logo — Upload school logo (admin, super_admin)
router.post('/:id/logo', requirePermission('settings', 'edit'), validateParams(idParamSchema), upload.single('logo'), schoolsController.uploadLogo);

// PATCH /api/schools/:id/trial/extend — More days of trial (super_admin only)
router.patch('/:id/trial/extend', requireSuperAdmin, validateParams(idParamSchema), validate(extendTrialSchema), schoolsController.extendTrial);

// PATCH /api/schools/:id/trial/subscribed — The school subscribed: its trial ends, it stays open (super_admin only)
router.patch('/:id/trial/subscribed', requireSuperAdmin, validateParams(idParamSchema), schoolsController.endTrialSubscribed);

// POST /api/schools/:id/purge — Erase a trial that ended (or a closed demonstration) for good (super_admin only)
router.post('/:id/purge', requireSuperAdmin, validateParams(idParamSchema), validate(purgeSchoolSchema), schoolsController.purge);

// DELETE /api/schools/:id — Soft delete school (super_admin only)
router.delete('/:id', requireSuperAdmin, validateParams(idParamSchema), schoolsController.delete);

export default router;
