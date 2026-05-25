import { z } from 'zod';

export const setSalarySchema = z
  .object({
    salaryType: z.enum(['fixed', 'per_student']).default('fixed'),
    baseSalary: z.number().positive().optional(),
    ratePerStudent: z.number().positive().optional(),
    currency: z.string().default('DZD'),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().optional(),
  })
  .refine(
    (d) => (d.salaryType === 'fixed' ? d.baseSalary != null : d.ratePerStudent != null),
    { message: 'baseSalary required for fixed type, ratePerStudent required for per_student type' },
  );

export const recordPaymentSchema = z.object({
  userId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  baseSalary: z.number().min(0),
  bonuses: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  studentCount: z.number().int().min(0).optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export type SetSalaryInput = z.infer<typeof setSalarySchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
