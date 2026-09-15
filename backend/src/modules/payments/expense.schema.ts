import { z } from 'zod';

export const createExpenseSchema = z.object({
  category: z
    .string()
    .min(1, 'Category is required')
    .max(255, 'Category must not exceed 255 characters'),
  description: z
    .string()
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
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export const updateExpenseSchema = z.object({
  category: z
    .string()
    .min(1, 'Category is required')
    .max(255, 'Category must not exceed 255 characters')
    .optional(),
  description: z
    .string()
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
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
