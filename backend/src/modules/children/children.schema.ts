import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

export const createChildSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(255, 'First name must not exceed 255 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(255, 'Last name must not exceed 255 characters'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female'], {
    errorMap: () => ({ message: 'Gender must be either male or female' }),
  }),
  enrollmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enrollment date must be in YYYY-MM-DD format'),
  academicYearId: uuidSchema,
});

export const updateChildSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(255, 'First name must not exceed 255 characters')
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(255, 'Last name must not exceed 255 characters')
    .optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .optional(),
  gender: z
    .enum(['male', 'female'], {
      errorMap: () => ({ message: 'Gender must be either male or female' }),
    })
    .optional(),
  enrollmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enrollment date must be in YYYY-MM-DD format')
    .optional(),
  academicYearId: uuidSchema.optional(),
});

export const enrollChildSchema = z.object({
  classroomId: uuidSchema,
});

export const createParentLinkSchema = z.object({
  parentUserId: uuidSchema,
  relationship: z.enum(['mother', 'father', 'guardian'], {
    errorMap: () => ({ message: 'Relationship must be mother, father, or guardian' }),
  }),
});

export const parentLinkParamsSchema = z.object({
  id: uuidSchema,
  linkId: uuidSchema,
});

export const createEmergencyContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Contact name is required')
    .max(255, 'Contact name must not exceed 255 characters'),
  relationship: z
    .string()
    .min(1, 'Relationship is required')
    .max(255, 'Relationship must not exceed 255 characters'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .max(50, 'Phone number must not exceed 50 characters'),
  isAuthorizedPickup: z.boolean().optional().default(false),
});

export const updateEmergencyContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Contact name is required')
    .max(255, 'Contact name must not exceed 255 characters')
    .optional(),
  relationship: z
    .string()
    .min(1, 'Relationship is required')
    .max(255, 'Relationship must not exceed 255 characters')
    .optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .max(50, 'Phone number must not exceed 50 characters')
    .optional(),
  isAuthorizedPickup: z.boolean().optional(),
});

export const emergencyContactParamsSchema = z.object({
  id: uuidSchema,
  contactId: uuidSchema,
});

export type CreateChildInput = z.infer<typeof createChildSchema>;
export type UpdateChildInput = z.infer<typeof updateChildSchema>;
export type EnrollChildInput = z.infer<typeof enrollChildSchema>;
export type CreateParentLinkInput = z.infer<typeof createParentLinkSchema>;
export type CreateEmergencyContactInput = z.infer<typeof createEmergencyContactSchema>;
export type UpdateEmergencyContactInput = z.infer<typeof updateEmergencyContactSchema>;
