import { Prisma } from '@prisma/client';

// --- Branch Billing Configuration ---

export interface BranchBillingConfig {
  branchId: string;
  billingCycle: 'monthly' | 'trimester' | 'custom';
  billingDueDay: number; // 1-28
  gracePeriodDays: number; // 0-60, default 5
  defaultRecurringFee: Prisma.Decimal; // 0.00 - 9,999,999.99
  notificationSetting: 'enabled' | 'disabled';
}

// --- Enrollment ---

export interface CreateEnrollmentInput {
  childId: string;
  branchId: string;
  academicYearId: string;
  startDate: Date;
  recurringFee?: Prisma.Decimal; // defaults to branch config
  registrationFee?: Prisma.Decimal | null;
  firstPeriodAmountDue?: Prisma.Decimal; // mid-cycle override
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
}

export interface ChannelSummary {
  total: Prisma.Decimal;
  paymentCount: number;
  correctionCount: number;
}
