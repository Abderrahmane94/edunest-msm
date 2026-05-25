import { z } from 'zod';

export const setSalarySchema = z.object({
  baseSalary: z.number().positive(),
  currency: z.string().default('DZD'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export const recordPaymentSchema = z.object({
  userId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  baseSalary: z.number().positive(),
  bonuses: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export type SetSalaryInput = z.infer<typeof setSalarySchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
