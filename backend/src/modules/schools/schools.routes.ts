import { Router } from 'express';
import multer from 'multer';
import { schoolsController } from './schools.controller';
import { requireSuperAdmin, requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createSchoolSchema, updateSchoolSchema } from './schools.schema';
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

// GET /api/schools/:id — Get school by ID (admin, super_admin)
router.get('/:id', requireAdmin, validateParams(idParamSchema), schoolsController.getById);

// PUT /api/schools/:id — Update school (admin, super_admin)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateSchoolSchema), schoolsController.update);

// PATCH /api/schools/:id/activate — Activate school (super_admin only)
router.patch('/:id/activate', requireSuperAdmin, validateParams(idParamSchema), schoolsController.activate);

// PATCH /api/schools/:id/deactivate — Deactivate school (super_admin only)
router.patch('/:id/deactivate', requireSuperAdmin, validateParams(idParamSchema), schoolsController.deactivate);

// GET /api/schools/:id/users — List users for a school (super_admin only)
router.get('/:id/users', requireSuperAdmin, validateParams(idParamSchema), schoolsController.listUsers);

// POST /api/schools/:id/users — Create a user directly in a specific school (super_admin only)
router.post('/:id/users', requireSuperAdmin, validateParams(idParamSchema), schoolsController.createUserInSchool);

// POST /api/schools/:id/logo — Upload school logo (admin, super_admin)
router.post('/:id/logo', requireAdmin, validateParams(idParamSchema), upload.single('logo'), schoolsController.uploadLogo);

export default router;
