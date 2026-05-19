import { z } from 'zod';

const directorSchema = z.object({
  firstName: z.string().min(1, 'Director first name is required').max(100),
  lastName: z.string().min(1, 'Director last name is required').max(100),
  email: z.string().email('Invalid director email address'),
  preferredLanguage: z.enum(['ar', 'fr']).optional().default('fr'),
});

export const createSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required').max(255, 'School name must not exceed 255 characters'),
  address: z.string().min(1, 'Address is required').max(500, 'Address must not exceed 500 characters'),
  wilaya: z.string().min(1, 'Wilaya is required').max(100, 'Wilaya must not exceed 100 characters'),
  contactEmail: z.string().email('Invalid contact email address'),
  contactPhone: z.string().min(1, 'Contact phone is required').max(20, 'Contact phone must not exceed 20 characters'),
  director: directorSchema,
});

export const updateSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required').max(255, 'School name must not exceed 255 characters').optional(),
  address: z.string().min(1, 'Address is required').max(500, 'Address must not exceed 500 characters').optional(),
  wilaya: z.string().min(1, 'Wilaya is required').max(100, 'Wilaya must not exceed 100 characters').optional(),
  contactEmail: z.string().email('Invalid contact email address').optional(),
  contactPhone: z.string().min(1, 'Contact phone is required').max(20, 'Contact phone must not exceed 20 characters').optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
