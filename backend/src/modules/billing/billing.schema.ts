import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  priceMonthly: z.number().min(0, 'Price must be non-negative'),
  priceAnnual: z.number().min(0).optional(),
  currency: z.string().optional(),
  maxChildren: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const assignPlanSchema = z.object({
  schoolId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'annual']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  trialDays: z.number().int().min(0).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  note: z.string().optional(),
}).refine(
  (d) => new Date(d.periodEnd) > new Date(d.periodStart),
  { message: 'Period end must be after period start', path: ['periodEnd'] },
);

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'overdue', 'cancelled', 'suspended']),
});
