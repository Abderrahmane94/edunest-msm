import { z } from 'zod';
import { isoDateSchema, pastDateSchema } from '../../utils/validators';

export const createExpenseSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(255, 'Category must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(1000, 'Description must not exceed 1000 characters'),
  amount: z
    .number()
    .positive('Amount must be a positive number')
    .max(99999999.99, 'Amount must not exceed 99999999.99'),
  currency: z
    .string()
    .default('DZD')
    .refine((val) => val === 'DZD', { message: 'Currency must be DZD' }),
  date: pastDateSchema,
  /** The school year it counts in; by default the one its date falls in. */
  academicYearId: z.string().uuid('Invalid academic year ID').optional(),
  /** Paid with money from the cash desk of whoever records it. */
  paidFromCash: z.boolean().optional(),
  /** Id made by the form: the same expense sent twice is saved once. */
  clientId: z.string().uuid('Invalid client ID').optional(),
});

export const updateExpenseSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(255, 'Category must not exceed 255 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
  amount: z
    .number()
    .positive('Amount must be a positive number')
    .max(99999999.99, 'Amount must not exceed 99999999.99')
    .optional(),
  currency: z
    .string()
    .refine((val) => val === 'DZD', { message: 'Currency must be DZD' })
    .optional(),
  date: pastDateSchema.optional(),
  academicYearId: z.string().uuid('Invalid academic year ID').optional(),
  paidFromCash: z.boolean().optional(),
});

const isoDate = isoDateSchema
  .optional();

/** Filters for the expenses list (combined with page/pageSize). */
export const expenseListFiltersSchema = z.object({
  category: z.string().max(50).optional(),
  from: isoDate,
  to: isoDate,
  search: z.string().trim().max(100).optional(),
  hasReceipt: z.enum(['true', 'false']).optional(),
  academic_year_id: z.string().uuid().optional(),
});

export type ExpenseListFilters = z.infer<typeof expenseListFiltersSchema>;

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
