import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validation.middleware';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from './auth.schema';

const router = Router();

// POST /api/auth/login
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), authController.refresh);

// POST /api/auth/logout
router.post('/logout', validate(logoutSchema), authController.logout);

// POST /api/auth/password-reset/request
router.post(
  '/password-reset/request',
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);

// POST /api/auth/password-reset/confirm
router.post(
  '/password-reset/confirm',
  validate(passwordResetConfirmSchema),
  authController.confirmPasswordReset
);

export default router;
