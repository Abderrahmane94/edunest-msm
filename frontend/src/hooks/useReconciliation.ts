import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch reconciliation report for a branch within a date range.
 * API: GET /api/payments/branches/:branchId/reconciliation?rangeStart=...&rangeEnd=...
 */
export function useReconciliation(
  branchId: string,
  rangeStart: string,
  rangeEnd: string
) {
  return useQuery({
    queryKey: ['reconciliation', branchId, rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('rangeStart', rangeStart);
      params.set('rangeEnd', rangeEnd);

      const res = await apiClient.get<unknown>(
        `/payments/branches/${branchId}/reconciliation?${params.toString()}`
      );

      if (!res.success) {
        throw new Error(
          res.error?.message ?? 'Failed to fetch reconciliation report'
        );
      }

      const raw = res.data as Record<string, unknown>;
      return mapReconciliationReport(raw);
    },
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
  };
}
