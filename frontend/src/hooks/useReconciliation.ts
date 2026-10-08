import { useQuery } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChannelSummary {
  total: string;
  paymentCount: number;
  correctionCount: number;
}

export interface ReconciliationReport {
  branchId: string;
  rangeStart: string;
  rangeEnd: string;
  channels: {
    cash: ChannelSummary;
    ccp: ChannelSummary;
    baridimob: ChannelSummary;
  };
  grandTotal: string;
  /** Expenses dated within the range, by category (largest first). */
  expenses: {
    total: string;
    count: number;
    byCategory: { category: string; total: string; count: number }[];
  };
  /** Salary payments (payroll) paid within the range. */
  salaries: { total: string; count: number };
  /** Income minus expenses minus salaries. */
  net: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch reconciliation report for a branch within a date range.
 * API: GET /api/payments/branches/:branchId/reconciliation?startDate=...&endDate=...
 *
 * Query param names must match the backend contract exactly (see
 * payments.controller.ts#getReconciliationReport, which requires `startDate`/
 * `endDate` and 400s otherwise) — this previously drifted to `rangeStart`/
 * `rangeEnd` and silently broke the reconciliation tab in production.
 */
export async function fetchReconciliationReport(
  branchId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<ReconciliationReport> {
  const params = new URLSearchParams();
  params.set('startDate', rangeStart);
  params.set('endDate', rangeEnd);

  const res = await apiClient.get<unknown>(
    `/payments/branches/${branchId}/reconciliation?${params.toString()}`
  );

  if (!res.success) {
    throw apiError(res.error, 'Failed to fetch reconciliation report');
  }

  return mapReconciliationReport(res.data as Record<string, unknown>);
}

export function useReconciliation(
  branchId: string,
  rangeStart: string,
  rangeEnd: string
) {
  return useQuery({
    queryKey: ['reconciliation', branchId, rangeStart, rangeEnd],
    queryFn: () => fetchReconciliationReport(branchId, rangeStart, rangeEnd),
    enabled: !!branchId && !!rangeStart && !!rangeEnd,
  });
}

// ─── Mapper ────────────────────────────────────────────────────────────────────

function mapChannelSummary(raw: Record<string, unknown>): ChannelSummary {
  return {
    total: String(raw.total ?? '0.00'),
    paymentCount: Number(raw.paymentCount ?? raw.payment_count ?? 0),
    correctionCount: Number(raw.correctionCount ?? raw.correction_count ?? 0),
  };
}

function mapReconciliationReport(raw: Record<string, unknown>): ReconciliationReport {
  const channels = (raw.channels ?? {}) as Record<string, Record<string, unknown>>;
  const expenses = (raw.expenses ?? {}) as Record<string, unknown>;
  const salaries = (raw.salaries ?? {}) as Record<string, unknown>;

  return {
    branchId: (raw.branchId ?? raw.branch_id) as string,
    rangeStart: (raw.rangeStart ?? raw.range_start) as string,
    rangeEnd: (raw.rangeEnd ?? raw.range_end) as string,
    channels: {
      cash: mapChannelSummary(channels.cash ?? {}),
      ccp: mapChannelSummary(channels.ccp ?? {}),
      baridimob: mapChannelSummary(channels.baridimob ?? {}),
    },
    grandTotal: String(raw.grandTotal ?? raw.grand_total ?? '0.00'),
    expenses: {
      total: String(expenses.total ?? '0.00'),
      count: Number(expenses.count ?? 0),
      byCategory: ((expenses.byCategory ?? []) as Record<string, unknown>[]).map((c) => ({
        category: String(c.category ?? ''),
        total: String(c.total ?? '0.00'),
        count: Number(c.count ?? 0),
      })),
    },
    salaries: {
      total: String(salaries.total ?? '0.00'),
      count: Number(salaries.count ?? 0),
    },
    net: String(raw.net ?? raw.grandTotal ?? '0.00'),
  };
}
