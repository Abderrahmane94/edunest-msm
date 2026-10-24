import { z } from 'zod';
import { uuidSchema, isoDateSchema, END_BEFORE_START } from '../../utils/validators';

export const createStaffProfileSchema = z.object({
  userId: uuidSchema,
  position: z
    .string()
    .trim()
    .min(1, 'Position is required')
    .max(200, 'Position must not exceed 200 characters'),
  contractType: z.enum(['full_time', 'part_time', 'contract'], {
    error: 'Contract type must be full_time, part_time, or contract',
  }),
  contractStart: isoDateSchema,
  contractEnd: isoDateSchema.optional(),
}).refine((p) => !p.contractEnd || p.contractEnd >= p.contractStart, { message: END_BEFORE_START, path: ['contractEnd'] });

export const updateStaffProfileSchema = z.object({
  position: z
    .string()
    .trim()
    .min(1, 'Position is required')
    .max(200, 'Position must not exceed 200 characters')
    .optional(),
  contractType: z
    .enum(['full_time', 'part_time', 'contract'], {
      error: 'Contract type must be full_time, part_time, or contract',
    })
    .optional(),
  contractStart: isoDateSchema.optional(),
  contractEnd: isoDateSchema.nullable().optional(),
}).refine((p) => !p.contractEnd || !p.contractStart || p.contractEnd >= p.contractStart, { message: END_BEFORE_START, path: ['contractEnd'] });

export type CreateStaffProfileInput = z.infer<typeof createStaffProfileSchema>;
export type UpdateStaffProfileInput = z.infer<typeof updateStaffProfileSchema>;
