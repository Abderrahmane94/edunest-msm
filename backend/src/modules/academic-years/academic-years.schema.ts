import { z } from 'zod';
import { isoDateSchema } from '../../utils/validators';

export const createAcademicYearSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Academic year name is required')
      .max(255, 'Academic year name must not exceed 255 characters'),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export const updateAcademicYearSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
