import { z } from 'zod';
import { isoDateSchema, pastDateSchema } from '../../utils/validators';

/** An amount of money: never negative, never beyond what the database holds. */
const money = z.number().min(0).max(99_999_999.99, 'Amount must not exceed 99999999.99');

export const setSalarySchema = z
  .object({
    salaryType: z.enum(['fixed', 'per_student']).default('fixed'),
    baseSalary: money.positive().optional(),
    ratePerStudent: money.positive().optional(),
    // per_student: rate per student per working day, or per day present.
    perStudentBasis: z.enum(['working_day', 'present_day']).default('working_day'),
    currency: z.string().default('DZD'),
    effectiveFrom: isoDateSchema,
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (d) => (d.salaryType === 'fixed' ? d.baseSalary != null : d.ratePerStudent != null),
    { message: 'baseSalary required for fixed type, ratePerStudent required for per_student type' },
  );

export const recordPaymentSchema = z.object({
  userId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  baseSalary: money,
  bonuses: money.default(0),
  deductions: money.default(0),
  studentCount: z.number().int().min(0).max(100_000).optional(),
  /** per_student: the student-days the base salary is computed on. */
  studentDays: z.number().int().min(0).max(10_000_000).optional(),
  paidAt: pastDateSchema,
  note: z.string().trim().max(1000).optional(),
});

export type SetSalaryInput = z.infer<typeof setSalarySchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
