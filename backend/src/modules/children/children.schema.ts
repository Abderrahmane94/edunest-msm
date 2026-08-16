import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

const bloodTypeSchema = z.enum(
  ['a_positive', 'a_negative', 'b_positive', 'b_negative', 'ab_positive', 'ab_negative', 'o_positive', 'o_negative'],
  { errorMap: () => ({ message: 'Invalid blood type' }) },
);

const nationalIdSchema = z.string().min(1).max(50);
const addressSchema = z.string().min(1).max(500);
const placeOfBirthSchema = z.string().min(1).max(255);

const medicalNoteTypeSchema = z.enum(['allergy', 'condition', 'medication'], {
  errorMap: () => ({ message: 'Type must be allergy, condition, or medication' }),
});
const medicalNoteSeveritySchema = z.enum(['low', 'medium', 'high'], {
  errorMap: () => ({ message: 'Severity must be low, medium, or high' }),
});

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
  nationalId: nationalIdSchema.optional(),
  address: addressSchema.optional(),
  placeOfBirth: placeOfBirthSchema.optional(),
  bloodType: bloodTypeSchema.optional(),
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
  nationalId: nationalIdSchema.optional(),
  address: addressSchema.optional(),
  placeOfBirth: placeOfBirthSchema.optional(),
  bloodType: bloodTypeSchema.optional(),
});

export const enrollChildSchema = z.object({
  classroomId: uuidSchema,
});

export const createParentLinkSchema = z.object({
  parentUserId: uuidSchema,
  relationship: z.enum(['mother', 'father', 'guardian'], {
    errorMap: () => ({ message: 'Relationship must be mother, father, or guardian' }),
  }),
  canPickup: z.boolean().optional(),
});

export const updateParentLinkSchema = z.object({
  relationship: z.enum(['mother', 'father', 'guardian'], {
    errorMap: () => ({ message: 'Relationship must be mother, father, or guardian' }),
  }),
  canPickup: z.boolean().optional(),
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
    .max(50, 'Phone number must not exceed 50 characters')
    .regex(/^\+?[0-9\s\-().]{6,50}$/, 'Phone number must contain only digits, spaces, and +-().'),
  address: addressSchema.optional(),
  nationalId: nationalIdSchema.optional(),
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
    .regex(/^\+?[0-9\s\-().]{6,50}$/, 'Phone number must contain only digits, spaces, and +-().')
    .optional(),
  address: addressSchema.optional(),
  nationalId: nationalIdSchema.optional(),
  isAuthorizedPickup: z.boolean().optional(),
});

export const emergencyContactParamsSchema = z.object({
  id: uuidSchema,
  contactId: uuidSchema,
});

export const createMedicalNoteSchema = z.object({
  type: medicalNoteTypeSchema,
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters'),
  details: z.string().max(2000, 'Details must not exceed 2000 characters').optional(),
  severity: medicalNoteSeveritySchema.optional().default('low'),
});

export const updateMedicalNoteSchema = z.object({
  type: medicalNoteTypeSchema.optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  details: z.string().max(2000, 'Details must not exceed 2000 characters').optional(),
  severity: medicalNoteSeveritySchema.optional(),
});

export const medicalNoteParamsSchema = z.object({
  id: uuidSchema,
  noteId: uuidSchema,
});

export type CreateChildInput = z.infer<typeof createChildSchema>;
export type UpdateChildInput = z.infer<typeof updateChildSchema>;
export type EnrollChildInput = z.infer<typeof enrollChildSchema>;
export type CreateParentLinkInput = z.infer<typeof createParentLinkSchema>;
export type UpdateParentLinkInput = z.infer<typeof updateParentLinkSchema>;
export type CreateEmergencyContactInput = z.infer<typeof createEmergencyContactSchema>;
export type UpdateEmergencyContactInput = z.infer<typeof updateEmergencyContactSchema>;
export type CreateMedicalNoteInput = z.infer<typeof createMedicalNoteSchema>;
export type UpdateMedicalNoteInput = z.infer<typeof updateMedicalNoteSchema>;
