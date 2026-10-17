import { z } from 'zod';
import { personNameSchema, phoneSchema, optionalEmailSchema, optionalPhoneSchema, EMAIL_OR_PHONE } from '../../utils/validators';

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'administrative', 'teacher', 'parent', 'student'], {
    errorMap: () => ({ message: 'Role must be admin, teacher, parent, or student' }),
  }),
});

export const registerUserSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  firstName: personNameSchema(100),
  lastName: personNameSchema(100),
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
  firstName: personNameSchema(100).optional(),
  lastName: personNameSchema(100).optional(),
  role: z.enum(['admin', 'administrative', 'teacher', 'parent'], {
    errorMap: () => ({ message: 'Role must be admin, teacher, or parent' }),
  }).optional(),
  preferredLanguage: z.enum(['ar', 'fr']).optional(),
  phone: phoneSchema(20).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  nationalId: z.string().trim().min(1).max(50).optional(),
});

/** "Mon profil": names and phone; an empty phone clears it. */
export const updateMyProfileSchema = z.object({
  firstName: personNameSchema(100).optional(),
  lastName: personNameSchema(100).optional(),
  phone: phoneSchema(20).nullable().optional(),
});

// Signs in with the email, or with the phone number when there is none.
export const createUserDirectlySchema = z.object({
  firstName: personNameSchema(100),
  lastName: personNameSchema(100),
  email: optionalEmailSchema(),
  role: z.enum(['admin', 'administrative', 'teacher', 'parent'], {
    errorMap: () => ({ message: 'Role must be admin, teacher, or parent' }),
  }),
  preferredLanguage: z.enum(['ar', 'fr']).optional().default('fr'),
  schoolId: z.string().uuid('Invalid school ID').optional(), // only used when super_admin provides it
  phone: optionalPhoneSchema(20),
  address: z.string().trim().min(1).max(500).optional(),
  nationalId: z.string().trim().min(1).max(50).optional(),
}).refine(EMAIL_OR_PHONE.check, EMAIL_OR_PHONE.message);

export type CreateUserDirectlyInput = z.infer<typeof createUserDirectlySchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type UpdateFcmTokenInput = z.infer<typeof updateFcmTokenSchema>;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
