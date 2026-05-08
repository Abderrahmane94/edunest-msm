import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

export const createStaffProfileSchema = z.object({
  userId: uuidSchema,
  position: z
    .string()
    .min(1, 'Position is required')
    .max(200, 'Position must not exceed 200 characters'),
  contractType: z.enum(['full_time', 'part_time', 'contract'], {
    errorMap: () => ({ message: 'Contract type must be full_time, part_time, or contract' }),
  }),
  contractStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Contract start must be a valid date (YYYY-MM-DD)'),
  contractEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Contract end must be a valid date (YYYY-MM-DD)')
    .optional(),
});

export const updateStaffProfileSchema = z.object({
  position: z
    .string()
    .min(1, 'Position is required')
    .max(200, 'Position must not exceed 200 characters')
    .optional(),
  contractType: z
    .enum(['full_time', 'part_time', 'contract'], {
      errorMap: () => ({ message: 'Contract type must be full_time, part_time, or contract' }),
    })
    .optional(),
  contractStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Contract start must be a valid date (YYYY-MM-DD)')
    .optional(),
  contractEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Contract end must be a valid date (YYYY-MM-DD)')
    .nullable()
    .optional(),
});

export type CreateStaffProfileInput = z.infer<typeof createStaffProfileSchema>;
export type UpdateStaffProfileInput = z.infer<typeof updateStaffProfileSchema>;
