import { z } from 'zod';
import { isoDateSchema } from '../../utils/validators';
import { orderedYearName } from '../../lib/school-year';

export const createAcademicYearSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Academic year name is required')
      .max(255, 'Academic year name must not exceed 255 characters')
      // Typed in a right-to-left field, "2026/2027" may arrive as "2027/2026".
      .transform(orderedYearName),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export const updateAcademicYearSchema = z
  .object({
    name: z.string().min(1).max(255).transform(orderedYearName).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
