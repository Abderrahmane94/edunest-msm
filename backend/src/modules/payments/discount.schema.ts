import { z } from 'zod';

export const createDiscountSchema = z.object({
  type: z.enum(['scholarship', 'sibling', 'staff', 'custom'], {
    errorMap: () => ({ message: 'Type must be one of: scholarship, sibling, staff, custom' }),
  }),
  // Exactly one of percentage / fixedAmount (checked below).
  percentage: z
    .number()
    .gt(0, 'Percentage must be greater than 0')
    .lte(100, 'Percentage must not exceed 100')
    .nullable()
    .optional(),
  /** Amount taken off each échéance the discount applies to. */
  fixedAmount: z
    .number()
    .gt(0, 'Amount must be greater than 0')
    .lte(9_999_999.99, 'Amount must not exceed 9,999,999.99')
    .nullable()
    .optional(),
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
  // The fee the discount applies to; null/omitted = every recurring fee.
  branchFeeId: z.string().uuid('Invalid fee ID').nullable().optional(),
}).refine((d) => (d.percentage != null) !== (d.fixedAmount != null), {
  message: 'Give either a percentage or a fixed amount',
  path: ['percentage'],
});

export const updateDiscountSchema = z.object({
  type: z.enum(['scholarship', 'sibling', 'staff', 'custom'], {
    errorMap: () => ({ message: 'Type must be one of: scholarship, sibling, staff, custom' }),
  }).optional(),
  percentage: z
    .number()
    .gt(0, 'Percentage must be greater than 0')
    .lte(100, 'Percentage must not exceed 100')
    .nullable()
    .optional(),
  fixedAmount: z
    .number()
    .gt(0, 'Amount must be greater than 0')
    .lte(9_999_999.99, 'Amount must not exceed 9,999,999.99')
    .nullable()
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
  // The fee the discount applies to; null/omitted = every recurring fee.
  branchFeeId: z.string().uuid('Invalid fee ID').nullable().optional(),
}).refine((d) => !(d.percentage != null && d.fixedAmount != null), {
  message: 'Give either a percentage or a fixed amount, not both',
  path: ['percentage'],
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
