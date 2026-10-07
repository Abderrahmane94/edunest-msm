import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import {
  enqueue,
  registerQueueHandler,
  useOfflineQueue,
  QueueRejectedError,
  type QueuedAction,
  type SyncNotice,
} from '@/lib/offlineQueue';
import type { BillingPeriod, PaymentChannel, RecordPaymentResult } from '@/hooks/usePayments';

/**
 * Payments recorded without a connection.
 *
 * - While online, the branch's children and unpaid échéances are kept on the
 *   device (the "snapshot"), so the payment form works offline.
 * - A payment saved offline goes through the offline queue, with an id made
 *   on the device: sent again, the server saves it once. It gets a
 *   provisional reference (PROV-…) until the server gives its receipt number.
 * - A payment the server refuses (e.g. the échéance was paid meanwhile on
 *   another device) stays on the device, "to correct". One recorded without
 *   échéances (they weren't available offline) waits "to allocate".
 */

export const PAYMENT = 'payment';
/** Error kept on a payment recorded without échéances: the admin picks them once online. */
export const NEEDS_ALLOCATION = 'NEEDS_ALLOCATION';

export interface OfflinePaymentPayload {
  clientId: string;
  branchId: string;
  childId: string;
  childName: string;
  totalAmount: number;
  channel: PaymentChannel;
  valueDate: string;
  referenceNote?: string;
  /** Empty for a payment still to allocate. `label` names the échéance on the provisional receipt. */
  allocations: Array<{ billingPeriodId: string; amount: number; label: string }>;
  recordedAt: string;
  recordedByName: string;
}

/** Kept once an offline payment is saved: its provisional reference gets the real receipt number. */
export interface SentPaymentNotice {
  paymentId: string;
  receiptNumber: string;
  provisionalRef: string;
  childName: string;
  totalAmount: number;
}

/** e.g. PROV-261008-3F9A: the date it was recorded and a part of its id. */
export function provisionalRef(payload: Pick<OfflinePaymentPayload, 'clientId' | 'recordedAt'>): string {
  const d = new Date(payload.recordedAt);
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `PROV-${ymd}-${payload.clientId.slice(0, 4).toUpperCase()}`;
}

/**
 * Sends a payment. Throws `ApiRequestError` when the server refuses it; any
 * other error means it couldn't be reached (offline, server restarting).
 */
export async function sendPayment(payload: OfflinePaymentPayload): Promise<RecordPaymentResult> {
  const res = await apiClient.post<Record<string, unknown>>(`/payments/records?branchId=${payload.branchId}`, {
    childId: payload.childId,
    totalAmount: payload.totalAmount,
    channel: payload.channel,
    valueDate: payload.valueDate,
    referenceNote: payload.referenceNote || undefined,
    allocations: payload.allocations.map(({ billingPeriodId, amount }) => ({ billingPeriodId, amount })),
    clientId: payload.clientId,
  });
  if (!res.success || !res.data) {
    throw new ApiRequestError(res.error ?? { code: 'UNKNOWN_ERROR', message: 'Failed to record payment' });
  }
  void refreshPaymentData();
  const d = res.data;
  return {
    id: d.id as string,
    receiptNumber: d.receiptNumber as string,
    totalAmount: String(d.totalAmount ?? '0'),
    channel: (d.channel as PaymentChannel) ?? payload.channel,
    valueDate: d.valueDate as string,
  };
}

function refreshPaymentData() {
  return Promise.all(
    ['payment-records', 'child-billing-periods', OFFLINE_SNAPSHOT_KEY].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

/** What's kept as the error of a refused payment: the server's reason when it gives one. */
function refusalOf(err: ApiRequestError): string {
  const reason = err.meta?.reason;
  return typeof reason === 'string' ? `reason:${reason}` : err.message;
}

registerQueueHandler<OfflinePaymentPayload>(PAYMENT, {
  send: async (payload) => {
    if (payload.allocations.length === 0) throw new QueueRejectedError(NEEDS_ALLOCATION);
    try {
      const result = await sendPayment(payload);
      return {
        paymentId: result.id,
        receiptNumber: result.receiptNumber,
        provisionalRef: provisionalRef(payload),
        childName: payload.childName,
        totalAmount: payload.totalAmount,
      } satisfies SentPaymentNotice;
    } catch (err) {
      // An expired session isn't a refusal: keep the payment until signed in again.
      if (err instanceof ApiRequestError && err.code !== 'UNAUTHORIZED') {
        throw new QueueRejectedError(refusalOf(err));
      }
      throw err;
    }
  },
});

/** Keeps a payment on the device and sends it as soon as possible. */
export function savePaymentOffline(payload: OfflinePaymentPayload): Promise<void> {
  return enqueue<OfflinePaymentPayload>(PAYMENT, `payment:${payload.clientId}`, payload);
}

/** Why a payment kept on the device couldn't be saved, in the user's language. */
export function paymentRefusalText(t: TFunction, error: string): string {
  if (error === NEEDS_ALLOCATION) return t('payments.offline.needsAllocation');
  if (error.startsWith('reason:')) {
    const reason = error.slice('reason:'.length);
    return t(`payments.offline.reasons.${reason}`, { defaultValue: t('payments.offline.reasons.other') });
  }
  return error;
}

// ─── Snapshot ──────────────────────────────────────────────────────────────────

export const OFFLINE_SNAPSHOT_KEY = 'payments-offline-snapshot';

export interface OfflineSnapshotChild {
  id: string;
  firstName: string;
  lastName: string;
  periods: BillingPeriod[];
}

export interface OfflineSnapshot {
  generatedAt: string;
  children: OfflineSnapshotChild[];
}

/**
 * The branch's children and unpaid échéances, refreshed whenever the app
 * opens or the connection returns, and kept on the device for offline use.
 */
export function useOfflinePaymentsSnapshot(branchId: string, enabled = true) {
  return useQuery({
    queryKey: [OFFLINE_SNAPSHOT_KEY, branchId],
    queryFn: async (): Promise<OfflineSnapshot> => {
      const res = await apiClient.get<{
        generatedAt: string;
        children: Array<Omit<OfflineSnapshotChild, 'periods'> & { periods: Array<Record<string, unknown>> }>;
      }>(`/payments/branches/${branchId}/offline-snapshot`);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load payments data');
      return {
        generatedAt: res.data.generatedAt,
        children: res.data.children.map((c) => ({
          ...c,
          periods: c.periods.map((p) => ({
            id: p.id as string,
            enrollmentId: '',
            periodStart: p.periodStart as string,
            periodEnd: p.periodEnd as string,
            dueDate: p.dueDate as string,
            graceEndDate: p.dueDate as string,
            amountDue: p.amountDue as string,
            baseAmount: (p.baseAmount as string | null) ?? null,
            isRegistrationPeriod: Boolean(p.isRegistrationPeriod),
            branchFeeName: (p.branchFeeName as string | null) ?? null,
            cancelledAt: null,
            isLate: Boolean(p.isLate),
            outstanding: p.outstanding as string,
            status: 'unpaid',
          })),
        })),
      };
    },
    enabled: enabled && !!branchId,
    // Refreshed when the app opens, when the connection returns and after
    // each payment; not on every return to the app (it can be a few hundred
    // KB for a large school).
    staleTime: 5 * 60 * 1000,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * Keeps the payments snapshot up to date on an admin's device (mounted in
 * the admin layout), and loads the PDF libraries once so the provisional
 * receipt can be saved as PDF offline too.
 */
export function usePreloadOfflinePayments(branchId: string, enabled: boolean) {
  useOfflinePaymentsSnapshot(branchId, enabled);
  React.useEffect(() => {
    if (!enabled || !navigator.onLine) return;
    const timer = setTimeout(() => {
      void import('html2canvas').catch(() => undefined);
      void import('jspdf').catch(() => undefined);
    }, 15_000);
    return () => clearTimeout(timer);
  }, [enabled]);
}

// ─── Payments kept on the device ───────────────────────────────────────────────

/** The current user's payments kept on the device, and those just sent. */
export function useQueuedPayments() {
  const { actions, notices, syncing } = useOfflineQueue();
  return React.useMemo(
    () => ({
      queued: actions.filter((a): a is QueuedAction<OfflinePaymentPayload> => a.kind === PAYMENT),
      sent: notices.filter((n): n is SyncNotice & { data: SentPaymentNotice } => n.kind === PAYMENT),
      syncing,
    }),
    [actions, notices, syncing],
  );
}

/**
 * Amounts already taken from each échéance by payments still on the device
 * (not yet known to the server), so the form doesn't offer them twice.
 */
export function pendingAmountsByPeriod(
  queued: QueuedAction<OfflinePaymentPayload>[],
  exceptActionId?: string,
): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const action of queued) {
    if (action.error || action.id === exceptActionId) continue;
    for (const a of action.payload.allocations) {
      amounts.set(a.billingPeriodId, (amounts.get(a.billingPeriodId) ?? 0) + a.amount);
    }
  }
  return amounts;
}
