import { z } from 'zod';

export const loginSchema = z.object({
  /** The email or the phone number (the name stays for the apps already installed). */
  email: z.string().trim().min(1, 'Email or phone number is required').max(254),
  password: z.string().min(1, 'Password is required'),
  // Only required when the email+password combination matches accounts in
  // more than one school; the client resubmits with this set once the user
  // picks which one they meant.
  schoolId: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export const changePasswordSchema = z.object({
  /** Asked for unless the account is on a temporary password (first login, reset by the office). */
  currentPassword: z.string().max(128).optional(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
