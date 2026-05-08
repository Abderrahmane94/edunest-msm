import { z } from 'zod';

export const createAcademicYearSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Academic year name is required')
      .max(255, 'Academic year name must not exceed 255 characters'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
