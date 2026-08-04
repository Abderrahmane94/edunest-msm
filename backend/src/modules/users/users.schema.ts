import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'teacher', 'parent', 'student'], {
    errorMap: () => ({ message: 'Role must be admin, teacher, parent, or student' }),
  }),
});

export const registerUserSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export const updateFcmTokenSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
});

export const updateLanguageSchema = z.object({
  preferredLanguage: z.enum(['ar', 'fr'], {
    errorMap: () => ({ message: 'Preferred language must be ar or fr' }),
  }),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  role: z.enum(['admin', 'teacher', 'parent'], {
    errorMap: () => ({ message: 'Role must be admin, teacher, or parent' }),
  }).optional(),
  preferredLanguage: z.enum(['ar', 'fr']).optional(),
  phone: z.string().min(1).max(20).optional(),
});

export const createUserDirectlySchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'teacher', 'parent'], {
    errorMap: () => ({ message: 'Role must be admin, teacher, or parent' }),
  }),
  preferredLanguage: z.enum(['ar', 'fr']).optional().default('fr'),
  schoolId: z.string().uuid('Invalid school ID').optional(), // only used when super_admin provides it
  phone: z.string().min(1).max(20).optional(),
});

export type CreateUserDirectlyInput = z.infer<typeof createUserDirectlySchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type UpdateFcmTokenInput = z.infer<typeof updateFcmTokenSchema>;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
