import { z } from 'zod';
import { isoDateSchema } from '../../utils/validators';

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
  schoolId: z.string().guid(),
  planId: z.string().guid(),
  billingCycle: z.enum(['monthly', 'annual']),
  startDate: isoDateSchema,
  trialDays: z.number().int().min(0).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  paidAt: isoDateSchema,
  note: z.string().optional(),
}).refine(
  (d) => new Date(d.periodEnd) > new Date(d.periodStart),
  { message: 'Period end must be after period start', path: ['periodEnd'] },
);

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'overdue', 'cancelled', 'suspended']),
});

export const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  periodStart: isoDateSchema.optional(),
  periodEnd: isoDateSchema.optional(),
  paidAt: isoDateSchema.optional(),
  note: z.string().nullable().optional(),
}).refine(
  (d) => !d.periodStart || !d.periodEnd || new Date(d.periodEnd) > new Date(d.periodStart),
  { message: 'Period end must be after period start', path: ['periodEnd'] },
);
