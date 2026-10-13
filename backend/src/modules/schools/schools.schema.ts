import { z } from 'zod';
import { personNameSchema, phoneSchema } from '../../utils/validators';

const directorSchema = z.object({
  firstName: personNameSchema(100),
  lastName: personNameSchema(100),
  email: z.string().email('Invalid director email address'),
  preferredLanguage: z.enum(['ar', 'fr']).optional().default('fr'),
});

export const createSchoolSchema = z.object({
  name: z.string().trim().min(1, 'School name is required').max(255, 'School name must not exceed 255 characters'),
  address: z.string().trim().min(1, 'Address is required').max(500, 'Address must not exceed 500 characters'),
  wilaya: z.string().trim().min(1, 'Wilaya is required').max(100, 'Wilaya must not exceed 100 characters'),
  contactEmail: z.string().email('Invalid contact email address'),
  contactPhone: phoneSchema(20),
  director: directorSchema,
});

export const updateSchoolSchema = z.object({
  name: z.string().trim().min(1, 'School name is required').max(255, 'School name must not exceed 255 characters').optional(),
  address: z.string().trim().min(1, 'Address is required').max(500, 'Address must not exceed 500 characters').optional(),
  wilaya: z.string().trim().min(1, 'Wilaya is required').max(100, 'Wilaya must not exceed 100 characters').optional(),
  contactEmail: z.string().email('Invalid contact email address').optional(),
  contactPhone: phoneSchema(20).optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
