import { z } from 'zod';

export const createDiscountSchema = z.object({
  type: z.enum(['scholarship', 'sibling', 'staff', 'custom'], {
    errorMap: () => ({ message: 'Type must be one of: scholarship, sibling, staff, custom' }),
  }),
  percentage: z
    .number()
    .gt(0, 'Percentage must be greater than 0')
    .lte(100, 'Percentage must not exceed 100'),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .nullable()
    .optional(),
  validFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validFrom must be in YYYY-MM-DD format'),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validTo must be in YYYY-MM-DD format')
    .nullable()
    .optional(),
});

export const updateDiscountSchema = z.object({
  type: z.enum(['scholarship', 'sibling', 'staff', 'custom'], {
    errorMap: () => ({ message: 'Type must be one of: scholarship, sibling, staff, custom' }),
  }).optional(),
  percentage: z
    .number()
    .gt(0, 'Percentage must be greater than 0')
    .lte(100, 'Percentage must not exceed 100')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .nullable()
    .optional(),
  validFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validFrom must be in YYYY-MM-DD format')
    .optional(),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validTo must be in YYYY-MM-DD format')
    .nullable()
    .optional(),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
