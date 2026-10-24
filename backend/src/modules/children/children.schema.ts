import { z } from 'zod';
import { uuidSchema, isoDateSchema, birthDateSchema, personNameSchema, optionalEmailSchema, optionalPhoneSchema, EMAIL_OR_PHONE } from '../../utils/validators';

const bloodTypeSchema = z.enum(
  ['a_positive', 'a_negative', 'b_positive', 'b_negative', 'ab_positive', 'ab_negative', 'o_positive', 'o_negative'],
  { error: 'Invalid blood type' },
);

const nationalIdSchema = z.string().min(1).max(50);
const addressSchema = z.string().min(1).max(500);
const placeOfBirthSchema = z.string().min(1).max(255);

/** Also checked against the stored dates when only one of the two is changed. */
export const ENROLLED_BEFORE_BIRTH = 'The enrollment date cannot be before the date of birth';

const medicalNoteTypeSchema = z.enum(['allergy', 'condition', 'medication'], {
  error: 'Type must be allergy, condition, or medication',
});
const medicalNoteSeveritySchema = z.enum(['low', 'medium', 'high'], {
  error: 'Severity must be low, medium, or high',
});

export const createChildSchema = z.object({
  firstName: personNameSchema(255),
  lastName: personNameSchema(255),
  dateOfBirth: birthDateSchema,
  gender: z.enum(['male', 'female'], {
    error: 'Gender must be either male or female',
  }),
  enrollmentDate: isoDateSchema,
  academicYearId: uuidSchema,
  nationalId: nationalIdSchema.optional(),
  address: addressSchema.optional(),
  placeOfBirth: placeOfBirthSchema.optional(),
  bloodType: bloodTypeSchema.optional(),
}).refine((c) => c.enrollmentDate >= c.dateOfBirth, {
  message: ENROLLED_BEFORE_BIRTH,
  path: ['enrollmentDate'],
});

export const updateChildSchema = z.object({
  firstName: personNameSchema(255)
    .optional(),
  lastName: personNameSchema(255)
    .optional(),
  dateOfBirth: birthDateSchema.optional(),
  gender: z
    .enum(['male', 'female'], {
      error: 'Gender must be either male or female',
    })
    .optional(),
  enrollmentDate: isoDateSchema.optional(),
  academicYearId: uuidSchema.optional(),
  nationalId: nationalIdSchema.optional(),
  address: addressSchema.optional(),
  placeOfBirth: placeOfBirthSchema.optional(),
  bloodType: bloodTypeSchema.optional(),
}).refine((c) => !c.enrollmentDate || !c.dateOfBirth || c.enrollmentDate >= c.dateOfBirth, {
  message: ENROLLED_BEFORE_BIRTH,
  path: ['enrollmentDate'],
});

export const enrollChildSchema = z.object({
  classroomId: uuidSchema,
});

export const createParentLinkSchema = z.object({
  parentUserId: uuidSchema,
  relationship: z.enum(['mother', 'father', 'guardian'], {
    error: 'Relationship must be mother, father, or guardian',
  }),
  canPickup: z.boolean().optional(),
});

export const updateParentLinkSchema = z.object({
  relationship: z.enum(['mother', 'father', 'guardian'], {
    error: 'Relationship must be mother, father, or guardian',
  }),
  canPickup: z.boolean().optional(),
});

export const parentLinkParamsSchema = z.object({
  id: uuidSchema,
  linkId: uuidSchema,
});

export const createEmergencyContactSchema = z.object({
  name: personNameSchema(255),
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
  name: personNameSchema(255).optional(),
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

const parentRelationshipSchema = z.enum(['mother', 'father', 'guardian'], {
  error: 'Relationship must be mother, father, or guardian',
});

/** Everything the creation wizard collects, saved in one transaction. */
export const registerChildSchema = z.object({
  child: createChildSchema,
  parent: z
    .object({
      relationship: parentRelationshipSchema,
      parentUserId: uuidSchema.optional(),
      newParent: z
        .object({
          firstName: personNameSchema(100),
          lastName: personNameSchema(100),
          email: optionalEmailSchema(),
          phone: optionalPhoneSchema(20),
        })
        // Signs in with the email, or with the phone number when there is none.
        .refine(EMAIL_OR_PHONE.check, EMAIL_OR_PHONE.message)
        .optional(),
    })
    .refine((p) => !!p.parentUserId !== !!p.newParent, {
      message: 'Give either an existing parent or a new one',
    })
    .optional(),
  emergencyContacts: z.array(createEmergencyContactSchema).max(20).default([]),
  medicalNotes: z.array(createMedicalNoteSchema).max(50).default([]),
  classroomId: uuidSchema.optional(),
  billing: z
    .object({
      branchId: uuidSchema,
      startDate: isoDateSchema,
      feeIds: z.array(uuidSchema).max(50).default([]),
    })
    .optional(),
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
export type RegisterChildInput = z.infer<typeof registerChildSchema>;
