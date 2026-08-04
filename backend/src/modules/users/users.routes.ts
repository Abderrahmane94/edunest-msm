import { Router } from 'express';
import { usersController } from './users.controller';
import { requireAdmin, requireActiveRole } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import {
  inviteUserSchema,
  registerUserSchema,
  updateFcmTokenSchema,
  updateLanguageSchema,
  updateUserSchema,
  createUserDirectlySchema,
} from './users.schema';
import { authController } from '../auth/auth.controller';
import { changePasswordSchema } from '../auth/auth.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/users/change-password — Change own password (authenticated, first-login forced change)
router.post('/change-password', requireActiveRole, validate(changePasswordSchema), authController.changePassword);

// POST /api/users — Create user directly in admin's school (admin only)
router.post('/', requireAdmin, validate(createUserDirectlySchema), usersController.create);

// POST /api/users/invite — Send invitation email (admin only)
router.post('/invite', requireAdmin, validate(inviteUserSchema), usersController.invite);

// GET /api/users/invitation/:token — Look up invitation info by token (public)
router.get('/invitation/:token', usersController.getInvitationInfo);

// POST /api/users/register — Complete registration via invitation token (public)
router.post('/register', validate(registerUserSchema), usersController.register);

// GET /api/users — List users in school (admin only)
router.get('/', requireAdmin, usersController.list);

// GET /api/users/:id — Get user by ID (admin only)
router.get('/:id', requireAdmin, validateParams(idParamSchema), usersController.getById);

// PATCH /api/users/:id — Update user profile (admin only)
router.patch('/:id', requireAdmin, validateParams(idParamSchema), validate(updateUserSchema), usersController.update);

// PATCH /api/users/:id/activate — Activate user (admin only)
router.patch('/:id/activate', requireAdmin, validateParams(idParamSchema), usersController.activate);

// PATCH /api/users/:id/deactivate — Deactivate user (admin only)
router.patch('/:id/deactivate', requireAdmin, validateParams(idParamSchema), usersController.deactivate);

// PATCH /api/users/:id/fcm-token — Update FCM token (any authenticated user)
router.patch(
  '/:id/fcm-token',
  requireActiveRole,
  validateParams(idParamSchema),
  validate(updateFcmTokenSchema),
  usersController.updateFcmToken,
);

// PATCH /api/users/:id/language — Update preferred language (any authenticated user)
router.patch(
  '/:id/language',
  requireActiveRole,
  validateParams(idParamSchema),
  validate(updateLanguageSchema),
  usersController.updateLanguage,
);

// DELETE /api/users/:id — Soft delete user (admin only)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), usersController.delete);

export default router;
