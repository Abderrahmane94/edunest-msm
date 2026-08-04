import { z } from 'zod';

// --- Decimal validation helper ---
// Accepts number or string, validates range and up to 2 decimal places
const decimalAmount = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num)) throw new Error('Invalid number');
      return num;
    })
    .pipe(
      z
        .number()
        .min(min, `Amount must be at least ${min}`)
        .max(max, `Amount must be at most ${max}`)
        .refine(
          (val) => {
            const parts = val.toString().split('.');
            return !parts[1] || parts[1].length <= 2;
          },
          { message: 'Amount must have at most 2 decimal places' }
        )
    );

// --- Branch Billing Configuration ---

export const createBranchConfigSchema = z.object({
  billing_cycle: z.enum(['monthly', 'trimester', 'custom'], {
    required_error: 'Billing cycle is required',
    invalid_type_error: 'Must be one of: monthly, trimester, custom',
  }),
  billing_due_day: z
    .number({ required_error: 'Billing due day is required' })
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 28')
    .max(28, 'Must be between 1 and 28'),
  grace_period_days: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Must be between 0 and 60')
    .max(60, 'Must be between 0 and 60')
    .default(5),
  default_recurring_fee: decimalAmount(0, 9999999.99),
  notification_setting: z.enum(['enabled', 'disabled']).default('disabled'),
});

export const updateBranchConfigSchema = z.object({
  billing_cycle: z.enum(['monthly', 'trimester', 'custom']).optional(),
  billing_due_day: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be between 1 and 28')
    .max(28, 'Must be between 1 and 28')
    .optional(),
  grace_period_days: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Must be between 0 and 60')
    .max(60, 'Must be between 0 and 60')
    .optional(),
  default_recurring_fee: decimalAmount(0, 9999999.99).optional(),
  notification_setting: z.enum(['enabled', 'disabled']).optional(),
});

// --- Branch Calendar ---

export const createBranchCalendarSchema = z
  .object({
    label: z
      .string({ required_error: 'Label is required' })
      .min(1, 'Label must be at least 1 character')
      .max(100, 'Label must be at most 100 characters'),
    period_start: z.coerce.date({ required_error: 'Period start is required' }),
    period_end: z.coerce.date({ required_error: 'Period end is required' }),
    due_date: z.coerce.date({ required_error: 'Due date is required' }),
  })
  .refine((data) => data.period_end >= data.period_start, {
    message: 'Period end must be on or after period start',
    path: ['period_end'],
  })
  .refine((data) => data.due_date >= data.period_start, {
    message: 'Due date must be on or after period start',
    path: ['due_date'],
  });

// --- Enrollment ---

export const createEnrollmentSchema = z.object({
  childId: z.string().uuid('Invalid child ID'),
  branchId: z.string().uuid('Invalid branch ID'),
  academicYearId: z.string().uuid('Invalid academic year ID'),
  startDate: z.coerce.date({ required_error: 'Start date is required' }),
  recurringFee: decimalAmount(0, 9999999.99).optional(),
  registrationFee: decimalAmount(0, 9999999.99).nullish(),
  firstPeriodAmountDue: decimalAmount(0, 9999999.99).optional(),
});

// --- Payment Recording ---

const paymentAllocationSchema = z.object({
  billingPeriodId: z.string().uuid('Invalid billing period ID'),
  amount: decimalAmount(-9999999.99, 9999999.99),
});

export const recordPaymentSchema = z.object({
  childId: z.string().uuid('Invalid child ID'),
  totalAmount: decimalAmount(0.01, 9999999.99),
  channel: z.enum(['cash', 'ccp', 'baridimob'], {
    required_error: 'Payment channel is required',
    invalid_type_error: 'Must be one of: cash, ccp, baridimob',
  }),
  valueDate: z.coerce.date({ required_error: 'Value date is required' }),
  referenceNote: z.string().min(1).max(500).optional(),
  allocations: z
    .array(paymentAllocationSchema)
    .min(1, 'At least one allocation is required'),
});

export const recordCorrectionSchema = z.object({
  childId: z.string().uuid('Invalid child ID'),
  totalAmount: decimalAmount(-9999999.99, -0.01),
  channel: z.enum(['cash', 'ccp', 'baridimob'], {
    required_error: 'Payment channel is required',
    invalid_type_error: 'Must be one of: cash, ccp, baridimob',
  }),
  valueDate: z.coerce.date({ required_error: 'Value date is required' }),
  referenceNote: z
    .string({ required_error: 'Reference note is required for corrections' })
    .min(1, 'Reference note is required for corrections')
    .max(500),
  correctsPaymentId: z.string().uuid('Invalid payment ID'),
  allocations: z
    .array(paymentAllocationSchema)
    .min(1, 'At least one allocation is required'),
});

// --- Enrollment Withdrawal ---

export const withdrawEnrollmentSchema = z.object({
  withdrawalDate: z.coerce.date({ required_error: 'Withdrawal date is required' }),
  currentPeriodAmountDue: decimalAmount(0, 9999999.99).optional(),
});

// --- Inferred Types ---

export type CreateBranchConfigInput = z.infer<typeof createBranchConfigSchema>;
export type UpdateBranchConfigInput = z.infer<typeof updateBranchConfigSchema>;
export type CreateBranchCalendarInput = z.infer<typeof createBranchCalendarSchema>;
export type CreateEnrollmentSchemaInput = z.infer<typeof createEnrollmentSchema>;
export type RecordPaymentSchemaInput = z.infer<typeof recordPaymentSchema>;
export type RecordCorrectionSchemaInput = z.infer<typeof recordCorrectionSchema>;
export type WithdrawEnrollmentInput = z.infer<typeof withdrawEnrollmentSchema>;
