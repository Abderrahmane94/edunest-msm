import { Prisma } from '@prisma/client';

// --- Branch Billing Configuration ---

export interface BranchBillingConfig {
  branchId: string;
  notificationSetting: 'enabled' | 'disabled';
}

// --- Enrollment ---

export interface CreateEnrollmentInput {
  childId: string;
  branchId: string;
  academicYearId: string;
  startDate: Date;
  /** Fees applied besides the whole-school ones. */
  feeIds?: string[];
}

export interface EnrollmentGenerationResult {
  enrollmentId: string;
  periodsCreated: number;
  earliestPeriodStart: Date;
  latestPeriodEnd: Date;
  totalAmountDue: Prisma.Decimal;
}

// --- Payment Recording ---

export interface RecordPaymentInput {
  childId: string;
  totalAmount: Prisma.Decimal;
  channel: 'cash' | 'ccp' | 'baridimob';
  valueDate: Date;
  recordedBy: string;
  referenceNote?: string;
  isCorrection: false;
  allocations: PaymentAllocationInput[];
  /** Id made by the recording device: the same payment sent twice is saved once. */
  clientId?: string;
}

export interface PaymentAllocationInput {
  billingPeriodId: string;
  amount: Prisma.Decimal;
}

export interface RecordCorrectionInput {
  childId: string;
  totalAmount: Prisma.Decimal; // negative
  channel: 'cash' | 'ccp' | 'baridimob';
  valueDate: Date;
  recordedBy: string;
  referenceNote: string; // required for corrections
  isCorrection: true;
  correctsPaymentId: string;
  allocations: PaymentAllocationInput[]; // negative amounts
}

// --- Billing Period Status Derivation ---

export interface DerivedPeriodStatus {
  status: 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
  isLate: boolean;
  totalPaid: Prisma.Decimal;
  outstanding: Prisma.Decimal;
}

// --- Reconciliation ---

export interface ReconciliationReport {
  branchId: string;
  rangeStart: Date;
  rangeEnd: Date;
  channels: {
    cash: ChannelSummary;
    ccp: ChannelSummary;
    baridimob: ChannelSummary;
  };
  grandTotal: Prisma.Decimal;
  /** Expenses dated within the range, school-wide, by category. */
  expenses: {
    total: Prisma.Decimal;
    count: number;
    byCategory: { category: string; total: Prisma.Decimal; count: number }[];
  };
  /** Salary payments (payroll) paid within the range. */
  salaries: { total: Prisma.Decimal; count: number };
  /** Income (grandTotal) minus expenses minus salaries. */
  net: Prisma.Decimal;
}

export interface ChannelSummary {
  total: Prisma.Decimal;
  paymentCount: number;
  correctionCount: number;
}
