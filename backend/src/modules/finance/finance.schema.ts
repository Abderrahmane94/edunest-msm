import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

// ─── Invoice Schemas ─────────────────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  childId: uuidSchema,
  parentUserId: uuidSchema,
  feeStructureId: uuidSchema,
  amount: z
    .number()
    .positive('Amount must be a positive number')
    .max(99999999.99, 'Amount must not exceed 99999999.99'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
});

export const bulkGenerateInvoicesSchema = z.object({
  classroomId: uuidSchema,
  feeStructureId: uuidSchema,
  amount: z
    .number()
    .positive('Amount must be a positive number')
    .max(99999999.99, 'Amount must not exceed 99999999.99'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type BulkGenerateInvoicesInput = z.infer<typeof bulkGenerateInvoicesSchema>;

// ─── Fee Structure Schemas ───────────────────────────────────────────────────

export const createFeeStructureSchema = z.object({
  academicYearId: uuidSchema,
  name: z
    .string()
    .min(1, 'Fee structure name is required')
    .max(255, 'Fee structure name must not exceed 255 characters'),
  amount: z
    .number()
    .positive('Amount must be a positive number')
    .max(99999999.99, 'Amount must not exceed 99999999.99'),
  currency: z
    .string()
    .default('DZD')
    .refine((val) => val === 'DZD', { message: 'Currency must be DZD' }),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time'], {
    errorMap: () => ({ message: 'Frequency must be one of: monthly, quarterly, annual, one_time' }),
  }),
  level: z
    .string()
    .max(255, 'Level must not exceed 255 characters')
    .nullable()
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .nullable()
    .optional(),
});

export const updateFeeStructureSchema = z.object({
  name: z
    .string()
    .min(1, 'Fee structure name is required')
    .max(255, 'Fee structure name must not exceed 255 characters')
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
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time'], {
    errorMap: () => ({ message: 'Frequency must be one of: monthly, quarterly, annual, one_time' }),
  }).optional(),
  level: z
    .string()
    .max(255, 'Level must not exceed 255 characters')
    .nullable()
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .nullable()
    .optional(),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;

// ─── Cash Payment Schemas ────────────────────────────────────────────────────

export const recordCashPaymentSchema = z.object({
  amount_received: z
    .number()
    .positive('Amount received must be a positive number')
    .max(99999999.99, 'Amount must not exceed 99999999.99'),
  received_by: uuidSchema,
  received_at: z
    .string()
    .datetime({ message: 'received_at must be a valid ISO 8601 datetime string' }),
  note: z
    .string()
    .max(1000, 'Note must not exceed 1000 characters')
    .nullable()
    .optional(),
});

export type RecordCashPaymentInput = z.infer<typeof recordCashPaymentSchema>;

// ─── Discount Schemas ────────────────────────────────────────────────────────

export const createDiscountSchema = z.object({
  childId: uuidSchema,
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

// ─── Expense Schemas ─────────────────────────────────────────────────────────

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

// ─── Financial Report Schemas ────────────────────────────────────────────────

export const monthlyReportQuerySchema = z.object({
  month: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12')),
  year: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(2000, 'Year must be at least 2000').max(2100, 'Year must not exceed 2100')),
});

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
