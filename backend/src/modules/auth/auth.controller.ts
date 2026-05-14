import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from './auth.service';
import type {
  LoginInput,
  RefreshInput,
  LogoutInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
  ChangePasswordInput,
} from './auth.schema';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as LoginInput;
      const result = await authService.login(input);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: 'AUTH_ERROR', message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as RefreshInput;
      const result = await authService.refresh(input);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: 'AUTH_ERROR', message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as LogoutInput;
      await authService.logout(input);
      res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error) {
      next(error);
    }
  },

  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as PasswordResetRequestInput;
      await authService.requestPasswordReset(input);
      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        data: { message: 'If the email exists, a password reset link has been sent' },
      });
    } catch (error) {
      next(error);
    }
  },

  async confirmPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as PasswordResetConfirmInput;
      await authService.confirmPasswordReset(input);
      res.status(200).json({
        success: true,
        data: { message: 'Password has been reset successfully' },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: 'AUTH_ERROR', message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { newPassword } = req.body as ChangePasswordInput;
      await authService.changePassword(userId, newPassword);
      res.status(200).json({ success: true, data: { message: 'Password changed successfully' } });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: 'AUTH_ERROR', message: error.message },
        });
        return;
      }
      next(error);
    }
  },
};
