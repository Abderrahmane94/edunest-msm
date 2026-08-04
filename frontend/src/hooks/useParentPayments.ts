import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PeriodStatus = 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
export type PaymentChannel = 'cash' | 'ccp' | 'baridimob';

export interface ParentBillingPeriod {
  id: string;
  childName: string;
  branchName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  amountDue: string;
  dueDate: string;
  graceEndDate: string;
  status: PeriodStatus;
  isLate: boolean;
  isRegistrationPeriod: boolean;
  cancelledAt: string | null;
}

export interface ParentPaymentAllocation {
  periodLabel: string;
  amount: string;
}

export interface ParentPaymentHistoryEntry {
  id: string;
  childName: string;
  receiptNumber: string;
  totalAmount: string;
  channel: PaymentChannel;
  valueDate: string;
  isCorrection: boolean;
  correctsReceiptNumber: string | null;
  allocations: ParentPaymentAllocation[];
}

export interface ParentChildBalance {
  childId: string;
  childName: string;
  branchName: string;
  outstandingBalance: string;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch billing periods for the authenticated parent's linked children.
 */
export function useParentBillingPeriods() {
  return useQuery({
    queryKey: ['parent-billing-periods'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/payments/parent/periods');
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch billing periods');
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((p) => mapParentBillingPeriod(p as Record<string, unknown>));
      }
      return [];
    },
  });
}

/**
 * Fetch payment history for the authenticated parent's linked children.
 */
export function useParentPaymentHistory() {
  return useQuery({
    queryKey: ['parent-payment-history'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/payments/parent/history');
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch payment history');
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((p) => mapParentPaymentHistory(p as Record<string, unknown>));
      }
      return [];
    },
  });
}

/**
 * Fetch outstanding balances per child for the authenticated parent.
 */
export function useParentBalances() {
  return useQuery({
    queryKey: ['parent-balances'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/payments/parent/balances');
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch balances');
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((b) => mapParentChildBalance(b as Record<string, unknown>));
      }
      return [];
    },
  });
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapParentBillingPeriod(raw: Record<string, unknown>): ParentBillingPeriod {
  return {
    id: raw.id as string,
    childName: (raw.childName ?? raw.child_name) as string,
    branchName: (raw.branchName ?? raw.branch_name) as string,
    periodLabel: (raw.periodLabel ?? raw.period_label ?? raw.label) as string,
    periodStart: (raw.periodStart ?? raw.period_start) as string,
    periodEnd: (raw.periodEnd ?? raw.period_end) as string,
    amountDue: String(raw.amountDue ?? raw.amount_due ?? '0'),
    dueDate: (raw.dueDate ?? raw.due_date) as string,
    graceEndDate: (raw.graceEndDate ?? raw.grace_end_date) as string,
    status: (raw.status as PeriodStatus) ?? 'unpaid',
    isLate: (raw.isLate ?? raw.is_late ?? false) as boolean,
    isRegistrationPeriod: (raw.isRegistrationPeriod ?? raw.is_registration_period ?? false) as boolean,
    cancelledAt: (raw.cancelledAt ?? raw.cancelled_at ?? null) as string | null,
  };
}

function mapParentPaymentHistory(raw: Record<string, unknown>): ParentPaymentHistoryEntry {
  const rawAllocations = raw.allocations as Record<string, unknown>[] | undefined;
  return {
    id: raw.id as string,
    childName: (raw.childName ?? raw.child_name) as string,
    receiptNumber: (raw.receiptNumber ?? raw.receipt_number) as string,
    totalAmount: String(raw.totalAmount ?? raw.total_amount ?? '0'),
    channel: (raw.channel as PaymentChannel) ?? 'cash',
    valueDate: (raw.valueDate ?? raw.value_date) as string,
    isCorrection: (raw.isCorrection ?? raw.is_correction ?? false) as boolean,
    correctsReceiptNumber: (raw.correctsReceiptNumber ?? raw.corrects_receipt_number ?? null) as string | null,
    allocations: rawAllocations
      ? rawAllocations.map((a) => ({
          periodLabel: (a.periodLabel ?? a.period_label ?? a.label) as string,
          amount: String(a.amount ?? '0'),
        }))
      : [],
  };
}

function mapParentChildBalance(raw: Record<string, unknown>): ParentChildBalance {
  return {
    childId: (raw.childId ?? raw.child_id) as string,
    childName: (raw.childName ?? raw.child_name) as string,
    branchName: (raw.branchName ?? raw.branch_name) as string,
    outstandingBalance: String(raw.outstandingBalance ?? raw.outstanding_balance ?? '0'),
  };
}
