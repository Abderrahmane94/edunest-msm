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
  notification_setting: z.enum(['enabled', 'disabled']).default('disabled'),
});

export const updateBranchConfigSchema = z.object({
  notification_setting: z.enum(['enabled', 'disabled']).optional(),
});

// --- Branch Calendar ---

export const createBranchCalendarSchema = z
  .object({
    label: z
      .string({ error: (issue) => (issue.input === undefined ? 'Label is required' : undefined) })
      .min(1, 'Label must be at least 1 character')
      .max(100, 'Label must be at most 100 characters'),
    period_start: z.coerce.date({ error: (issue) => (issue.input === undefined ? 'Period start is required' : undefined) }),
    period_end: z.coerce.date({ error: (issue) => (issue.input === undefined ? 'Period end is required' : undefined) }),
  })
  .refine((data) => data.period_end >= data.period_start, {
    message: 'Period end must be on or after period start',
    path: ['period_end'],
  });

// --- Enrollment ---

export const createEnrollmentSchema = z.object({
  childId: z.string().guid('Invalid child ID'),
  branchId: z.string().guid('Invalid branch ID'),
  academicYearId: z.string().guid('Invalid academic year ID'),
  startDate: z.coerce.date({ error: (issue) => (issue.input === undefined ? 'Start date is required' : undefined) }),
  // Fees to apply besides the whole-school ones (recurring billed from startDate).
  feeIds: z.array(z.string().guid('Invalid fee ID')).max(50).optional(),
});

// --- Payment Recording ---

const paymentAllocationSchema = z.object({
  billingPeriodId: z.string().guid('Invalid billing period ID'),
  amount: decimalAmount(-9999999.99, 9999999.99),
});

export const recordPaymentSchema = z.object({
  childId: z.string().guid('Invalid child ID'),
  totalAmount: decimalAmount(0.01, 9999999.99),
  channel: z.enum(['cash', 'ccp', 'baridimob'], {
    error: (issue) => (issue.input === undefined ? 'Payment channel is required' : 'Must be one of: cash, ccp, baridimob'),
  }),
  valueDate: z.coerce.date({ error: (issue) => (issue.input === undefined ? 'Value date is required' : undefined) }),
  referenceNote: z.string().min(1).max(500).optional(),
  allocations: z
    .array(paymentAllocationSchema)
    .min(1, 'At least one allocation is required'),
  clientId: z.string().guid('Invalid client ID').optional(),
});

export const recordCorrectionSchema = z.object({
  childId: z.string().guid('Invalid child ID'),
  totalAmount: decimalAmount(-9999999.99, -0.01),
  channel: z.enum(['cash', 'ccp', 'baridimob'], {
    error: (issue) => (issue.input === undefined ? 'Payment channel is required' : 'Must be one of: cash, ccp, baridimob'),
  }),
  valueDate: z.coerce.date({ error: (issue) => (issue.input === undefined ? 'Value date is required' : undefined) }),
  referenceNote: z
    .string({ error: (issue) => (issue.input === undefined ? 'Reference note is required for corrections' : undefined) })
    .min(1, 'Reference note is required for corrections')
    .max(500),
  correctsPaymentId: z.string().guid('Invalid payment ID'),
  allocations: z
    .array(paymentAllocationSchema)
    .min(1, 'At least one allocation is required'),
  /** Id made by the form: the same correction sent twice is saved once. */
  clientId: z.string().guid('Invalid client ID').optional(),
});

// --- Enrollment Withdrawal ---

export const withdrawEnrollmentSchema = z.object({
  withdrawalDate: z.coerce.date({ error: (issue) => (issue.input === undefined ? 'Withdrawal date is required' : undefined) }),
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
