import { z } from 'zod';
import { isoDateSchema, END_BEFORE_START } from '../../utils/validators';

export const createDiscountSchema = z.object({
  type: z.enum(['scholarship', 'sibling', 'staff', 'custom'], {
    error: 'Type must be one of: scholarship, sibling, staff, custom',
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
  validFrom: isoDateSchema,
  validTo: isoDateSchema
    .nullable()
    .optional(),
  // The fee the discount applies to; null/omitted = every recurring fee.
  branchFeeId: z.string().guid('Invalid fee ID').nullable().optional(),
}).refine((d) => (d.percentage != null) !== (d.fixedAmount != null), {
  message: 'Give either a percentage or a fixed amount',
  path: ['percentage'],
}).refine((d) => !d.validTo || d.validTo >= d.validFrom, { message: END_BEFORE_START, path: ['validTo'] });

export const updateDiscountSchema = z.object({
  type: z.enum(['scholarship', 'sibling', 'staff', 'custom'], {
    error: 'Type must be one of: scholarship, sibling, staff, custom',
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
  validFrom: isoDateSchema
    .optional(),
  validTo: isoDateSchema
    .nullable()
    .optional(),
  // The fee the discount applies to; null/omitted = every recurring fee.
  branchFeeId: z.string().guid('Invalid fee ID').nullable().optional(),
}).refine((d) => !(d.percentage != null && d.fixedAmount != null), {
  message: 'Give either a percentage or a fixed amount, not both',
  path: ['percentage'],
}).refine((d) => !d.validTo || !d.validFrom || d.validTo >= d.validFrom, { message: END_BEFORE_START, path: ['validTo'] });

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
