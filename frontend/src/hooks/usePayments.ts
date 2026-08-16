import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PaymentChannel = 'cash' | 'ccp' | 'baridimob';

export interface PaymentAllocationInput {
  billingPeriodId: string;
  amount: number;
}

export interface RecordPaymentInput {
  childId: string;
  totalAmount: number;
  channel: PaymentChannel;
  valueDate: string;
  referenceNote?: string;
  allocations: PaymentAllocationInput[];
}

export interface PaymentRecord {
  id: string;
  branchId: string;
  childId: string;
  receiptNumber: string;
  totalAmount: string;
  channel: PaymentChannel;
  valueDate: string;
  recordedBy: string;
  referenceNote: string | null;
  isCorrection: boolean;
  correctsPaymentId: string | null;
  createdAt: string;
  child?: { id: string; firstName: string; lastName: string };
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  billingPeriodId: string;
  amount: string;
  billingPeriod?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    isRegistrationPeriod: boolean;
  };
}

export interface BillingPeriod {
  id: string;
  enrollmentId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  graceEndDate: string;
  amountDue: string;
  isRegistrationPeriod: boolean;
  branchFeeName?: string | null;
  cancelledAt: string | null;
  status?: string;
  isLate?: boolean;
  totalPaid?: string;
  outstanding?: string;
}

export interface RecordPaymentResult {
  id: string;
  receiptNumber: string;
  totalAmount: string;
  channel: PaymentChannel;
  valueDate: string;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch billing periods for a specific child (with derived status).
 */
export function useChildBillingPeriods(childId: string) {
  return useQuery({
    queryKey: ['child-billing-periods', childId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/payments/children/${childId}/periods`
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch billing periods');
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((p) => mapBillingPeriod(p as Record<string, unknown>));
      }
      return [];
    },
    enabled: !!childId,
  });
}

/**
 * Record a new payment.
 */
export function useRecordPayment(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecordPaymentInput): Promise<RecordPaymentResult> => {
      const res = await apiClient.post<unknown>(
        `/payments/records?branchId=${branchId}`,
        {
          childId: data.childId,
          totalAmount: data.totalAmount,
          channel: data.channel,
          valueDate: data.valueDate,
          referenceNote: data.referenceNote || undefined,
          allocations: data.allocations,
        }
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to record payment');
      }
      const d = res.data as Record<string, unknown>;
      return {
        id: d.id as string,
        receiptNumber: (d.receiptNumber ?? d.receipt_number) as string,
        totalAmount: String(d.totalAmount ?? d.total_amount ?? '0'),
        channel: (d.channel as PaymentChannel) ?? 'cash',
        valueDate: (d.valueDate ?? d.value_date) as string,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-records'] });
      qc.invalidateQueries({ queryKey: ['child-billing-periods'] });
    },
  });
}

export interface PaymentRecordFilters {
  startDate?: string;
  endDate?: string;
  channel?: string;
  childId?: string;
}

/**
 * List payment records for a branch.
 */
export function usePaymentRecords(branchId: string, filters?: PaymentRecordFilters) {
  const queryParams = new URLSearchParams();
  if (branchId) queryParams.set('branchId', branchId);
  if (filters?.startDate) queryParams.set('startDate', filters.startDate);
  if (filters?.endDate) queryParams.set('endDate', filters.endDate);
  if (filters?.channel) queryParams.set('channel', filters.channel);
  if (filters?.childId) queryParams.set('childId', filters.childId);

  return useQuery({
    queryKey: ['payment-records', branchId, filters],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/payments/records?${queryParams.toString()}`
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch payment records');
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((r) => mapPaymentRecord(r as Record<string, unknown>));
      }
      return [];
    },
    enabled: !!branchId,
  });
}

/**
 * Fetch a single payment record with full allocations (including billing period details).
 */
export function usePaymentRecordDetail(paymentId: string | null) {
  return useQuery({
    queryKey: ['payment-record-detail', paymentId],
    queryFn: async () => {
      if (!paymentId) return null;
      const res = await apiClient.get<unknown>(`/payments/records/${paymentId}`);
      if (!res.success || !res.data) return null;
      return mapPaymentRecordWithAllocations(res.data as Record<string, unknown>);
    },
    enabled: !!paymentId,
  });
}

export interface RecordCorrectionInput {
  childId: string;
  totalAmount: number;
  channel: PaymentChannel;
  valueDate: string;
  referenceNote: string;
  correctsPaymentId: string;
  allocations: PaymentAllocationInput[];
}

/**
 * Fetch receipt URL/data for a payment record.
 * Returns the receipt URL or opens it in a new tab.
 */
export function usePaymentReceiptUrl(paymentId: string | null) {
  return useQuery({
    queryKey: ['payment-receipt', paymentId],
    queryFn: async () => {
      if (!paymentId) return null;
      // The receipt endpoint generates a receipt document
      const res = await apiClient.get<unknown>(`/payments/records/${paymentId}/receipt`);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch receipt');
      }
      return res.data as Record<string, unknown>;
    },
    enabled: !!paymentId,
  });
}

/**
 * Record a correction (negative payment) against an original payment record.
 */
export function useRecordCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecordCorrectionInput): Promise<RecordPaymentResult> => {
      const res = await apiClient.post<unknown>('/payments/records/correction', {
        childId: data.childId,
        totalAmount: data.totalAmount,
        channel: data.channel,
        valueDate: data.valueDate,
        referenceNote: data.referenceNote,
        correctsPaymentId: data.correctsPaymentId,
        allocations: data.allocations,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to record correction');
      }
      const d = res.data as Record<string, unknown>;
      return {
        id: d.id as string,
        receiptNumber: (d.receiptNumber ?? d.receipt_number) as string,
        totalAmount: String(d.totalAmount ?? d.total_amount ?? '0'),
        channel: (d.channel as PaymentChannel) ?? 'cash',
        valueDate: (d.valueDate ?? d.value_date) as string,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-records'] });
      qc.invalidateQueries({ queryKey: ['child-billing-periods'] });
      qc.invalidateQueries({ queryKey: ['payment-record-detail'] });
    },
  });
}

// ─── Receipt Types ─────────────────────────────────────────────────────────────

export interface ReceiptAllocationLine {
  periodLabel: string;
  amount: string;
  periodStart: string;
}

export interface ReceiptCorrectionLine {
  receiptNumber: string;
  valueDate: string;
  amount: string;
}

export interface ReceiptData {
  language: 'ar' | 'fr';
  direction: 'rtl' | 'ltr';
  labels: {
    receiptTitle: string;
    correctionReceiptTitle: string;
    schoolName: string;
    branchName: string;
    receiptNumber: string;
    childName: string;
    amount: string;
    channel: string;
    valueDate: string;
    recordedBy: string;
    allocatedPeriods: string;
    periodLabel: string;
    periodAmount: string;
    correctionMarker: string;
    correctionReason: string;
    correctsReceipt: string;
    correctionRecord: string;
    currency: string;
    channelCash: string;
    channelCcp: string;
    channelBaridimob: string;
    direction: 'rtl' | 'ltr';
  };
  title: string;
  schoolName: string;
  branchName: string;
  receiptNumber: string;
  childName: string;
  amount: string;
  channel: string;
  channelRaw: 'cash' | 'ccp' | 'baridimob';
  valueDate: string;
  recordedBy: string;
  allocations: ReceiptAllocationLine[];
  isCorrepted: boolean;
  correctionMarker: string | null;
  corrections: ReceiptCorrectionLine[];
  isCorrection: boolean;
  correctionReason: string | null;
  correctsReceiptNumber: string | null;
}

/**
 * Fetch receipt data for a payment record.
 * API: GET /payments/records/:id/receipt
 */
export function useReceipt(paymentRecordId: string | null, language?: string) {
  return useQuery({
    queryKey: ['receipt', paymentRecordId, language],
    queryFn: async () => {
      if (!paymentRecordId) return null;
      const lang = language === 'ar' ? 'ar' : 'fr';
      const res = await apiClient.get<unknown>(
        `/payments/records/${paymentRecordId}/receipt?language=${lang}`
      );
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Failed to fetch receipt');
      }
      return res.data as ReceiptData;
    },
    enabled: !!paymentRecordId,
  });
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapBillingPeriod(raw: Record<string, unknown>): BillingPeriod {
  return {
    id: raw.id as string,
    enrollmentId: (raw.enrollmentId ?? raw.enrollment_id) as string,
    periodStart: (raw.periodStart ?? raw.period_start) as string,
    periodEnd: (raw.periodEnd ?? raw.period_end) as string,
    dueDate: (raw.dueDate ?? raw.due_date) as string,
    graceEndDate: (raw.graceEndDate ?? raw.grace_end_date) as string,
    amountDue: String(raw.amountDue ?? raw.amount_due ?? '0'),
    isRegistrationPeriod: (raw.isRegistrationPeriod ?? raw.is_registration_period ?? false) as boolean,
    branchFeeName: (raw.branchFeeName ?? raw.branch_fee_name ?? null) as string | null,
    cancelledAt: (raw.cancelledAt ?? raw.cancelled_at ?? null) as string | null,
    status: (raw.status as string) ?? undefined,
    isLate: (raw.isLate ?? raw.is_late) as boolean | undefined,
    totalPaid: raw.totalPaid != null ? String(raw.totalPaid) : undefined,
    outstanding: raw.outstanding != null ? String(raw.outstanding) : undefined,
  };
}

function mapPaymentRecord(raw: Record<string, unknown>): PaymentRecord {
  const child = raw.child as Record<string, unknown> | undefined;
  return {
    id: raw.id as string,
    branchId: (raw.branchId ?? raw.branch_id) as string,
    childId: (raw.childId ?? raw.child_id) as string,
    receiptNumber: (raw.receiptNumber ?? raw.receipt_number) as string,
    totalAmount: String(raw.totalAmount ?? raw.total_amount ?? '0'),
    channel: (raw.channel as PaymentChannel) ?? 'cash',
    valueDate: (raw.valueDate ?? raw.value_date) as string,
    recordedBy: (raw.recordedBy ?? raw.recorded_by) as string,
    referenceNote: (raw.referenceNote ?? raw.reference_note ?? null) as string | null,
    isCorrection: (raw.isCorrection ?? raw.is_correction ?? false) as boolean,
    correctsPaymentId: (raw.correctsPaymentId ?? raw.corrects_payment_id ?? null) as string | null,
    createdAt: (raw.createdAt ?? raw.created_at) as string,
    child: child
      ? {
          id: child.id as string,
          firstName: (child.firstName ?? child.first_name) as string,
          lastName: (child.lastName ?? child.last_name) as string,
        }
      : undefined,
  };
}

function mapPaymentRecordWithAllocations(raw: Record<string, unknown>): PaymentRecord {
  const record = mapPaymentRecord(raw);
  const rawAllocations = raw.allocations as Record<string, unknown>[] | undefined;
  if (rawAllocations && Array.isArray(rawAllocations)) {
    record.allocations = rawAllocations.map((a) => {
      const bp = a.billingPeriod as Record<string, unknown> | undefined;
      return {
        id: a.id as string,
        billingPeriodId: (a.billingPeriodId ?? a.billing_period_id) as string,
        amount: String(a.amount ?? '0'),
        billingPeriod: bp
          ? {
              id: bp.id as string,
              periodStart: (bp.periodStart ?? bp.period_start) as string,
              periodEnd: (bp.periodEnd ?? bp.period_end) as string,
              isRegistrationPeriod: (bp.isRegistrationPeriod ?? bp.is_registration_period ?? false) as boolean,
            }
          : undefined,
      };
    });
  }
  return record;
}
