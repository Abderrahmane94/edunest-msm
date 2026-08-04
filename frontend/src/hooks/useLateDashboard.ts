import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LatePeriodStatus = 'late' | 'late_partial';

export interface LateDashboardEntry {
  id: string;
  childName: string;
  periodLabel: string;
  dueDate: string;
  graceEndDate: string;
  amountDue: string;
  totalPaid: string;
  outstanding: string;
  status: LatePeriodStatus;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch late payments dashboard data for a branch.
 * Optionally filter by status (late / late_partial).
 */
export function useLateDashboard(branchId: string, statusFilter?: LatePeriodStatus | '') {
  const queryParams = new URLSearchParams();
  if (statusFilter) {
    queryParams.set('status', statusFilter);
  }

  return useQuery({
    queryKey: ['late-dashboard', branchId, statusFilter],
    queryFn: async () => {
      const qs = queryParams.toString();
      const url = `/payments/branches/${branchId}/late${qs ? `?${qs}` : ''}`;
      const res = await apiClient.get<unknown>(url);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch late dashboard');
      }
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((entry) => mapLateDashboardEntry(entry as Record<string, unknown>));
      }
      return [];
    },
    enabled: !!branchId,
  });
}

// ─── Mapper ────────────────────────────────────────────────────────────────────

function mapLateDashboardEntry(raw: Record<string, unknown>): LateDashboardEntry {
  return {
    id: (raw.id ?? raw.billingPeriodId ?? raw.billing_period_id ?? '') as string,
    childName: (raw.childName ?? raw.child_name ?? '') as string,
    periodLabel: (raw.periodLabel ?? raw.period_label ?? '') as string,
    dueDate: (raw.dueDate ?? raw.due_date ?? '') as string,
    graceEndDate: (raw.graceEndDate ?? raw.grace_end_date ?? '') as string,
    amountDue: String(raw.amountDue ?? raw.amount_due ?? '0'),
    totalPaid: String(raw.totalPaid ?? raw.total_paid ?? '0'),
    outstanding: String(raw.outstanding ?? '0'),
    status: (raw.status as LatePeriodStatus) ?? 'late',
  };
}
