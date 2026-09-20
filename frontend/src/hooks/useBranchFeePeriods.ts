import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { BranchCalendarEntry } from '@/hooks/useBranchCalendar';

export interface FeePeriod extends BranchCalendarEntry {
  isAssigned: boolean;
}

/**
 * Lists every calendar period for the fee's branch + academic year, flagged
 * with whether it's currently assigned to this fee.
 */
export function useFeePeriods(branchFeeId: string | undefined, academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['fee-periods', branchFeeId, academicYearId],
    queryFn: async () => {
      const res = await apiClient.get<{ periods: FeePeriod[] }>(
        `/payments/fees/${branchFeeId}/periods?academicYearId=${academicYearId}`,
      );
      return res.data?.periods ?? [];
    },
    enabled: !!branchFeeId && !!academicYearId,
  });
}

/**
 * Replaces a fee's period assignments for one academic year.
 */
export function useSetFeePeriods(branchFeeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ academicYearId, periodIds }: { academicYearId: string; periodIds: string[] }) => {
      const res = await apiClient.put<{ periods: FeePeriod[] }>(`/payments/fees/${branchFeeId}/periods`, {
        academicYearId,
        periodIds,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to save period assignments');
      }
      return res.data?.periods ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-periods', branchFeeId] });
    },
  });
}
