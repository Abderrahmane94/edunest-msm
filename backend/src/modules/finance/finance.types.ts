import { DiscountType, FeeFrequency, InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';

export interface ExpenseResponse {
  id: string;
  schoolId: string;
  category: string;
  description: string;
  amount: Prisma.Decimal;
  currency: string;
  date: Date;
  receiptPublicId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface PaymentAuditLogResponse {
  id: string;
  invoiceId: string;
  action: string;
  performedBy: string;
  previousStatus: string | null;
  newStatus: string;
  metadata: unknown;
  createdAt: Date;
}

export interface MonthlyReportResponse {
  month: number;
  year: number;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalExpenses: number;
  paymentMethodBreakdown: PaymentMethodBreakdown;
}

export interface FinancialSummaryResponse {
  totalRevenue: number;
  collectionRate: number;
  totalExpenses: number;
  expenseBreakdownByCategory: Record<string, number>;
  paymentMethodBreakdown: PaymentMethodBreakdown;
}

export interface FeeStructureResponse {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  amount: Prisma.Decimal;
  currency: string;
  frequency: FeeFrequency;
  level: string | null;
  description: string | null;
  createdAt: Date;
}

export interface CreateFeeStructureInput {
  academicYearId: string;
  name: string;
  amount: number;
  currency?: string;
  frequency: FeeFrequency;
  level?: string | null;
  description?: string | null;
}

export interface UpdateFeeStructureInput {
  name?: string;
  amount?: number;
  currency?: string;
  frequency?: FeeFrequency;
  level?: string | null;
  description?: string | null;
}

export interface InvoiceResponse {
  id: string;
  schoolId: string;
  childId: string;
  parentUserId: string;
  feeStructureId: string;
  amount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal | null;
  currency: string;
  dueDate: Date;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod | null;
  chargilyCheckoutId: string | null;
  chargilyPaymentUrl: string | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface CashPaymentResponse {
  id: string;
  invoiceId: string;
  schoolId: string;
  amount: Prisma.Decimal;
  receivedBy: string;
  receivedAt: Date;
  note: string | null;
  createdAt: Date;
}

export interface PaymentMethodBreakdown {
  online: { count: number; total: number };
  cash: { count: number; total: number };
}

export interface DiscountResponse {
  id: string;
  childId: string;
  schoolId: string;
  type: DiscountType;
  percentage: Prisma.Decimal;
  description: string | null;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
}
