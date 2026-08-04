import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

export interface BranchCalendarEntry {
  id: string;
  branchId: string;
  academicYearId: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchCalendarInput {
  label: string;
  period_start: string;
  period_end: string;
  due_date: string;
  academicYearId: string;
}

export interface UpdateBranchCalendarInput {
  label: string;
  period_start: string;
  period_end: string;
  due_date: string;
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export function useBranches() {
  return useQuery({
    queryKey: ['payment-branches'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/payments/branches');
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw as Branch[];
      }
      return [];
    },
  });
}

// ─── Branch Calendar ──────────────────────────────────────────────────────────

export function useBranchCalendar(branchId: string | undefined, academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['branch-calendar', branchId, academicYearId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/payments/branches/${branchId}/calendar?academicYearId=${academicYearId}`,
      );
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw as BranchCalendarEntry[];
      }
      return [];
    },
    enabled: !!branchId && !!academicYearId,
  });
}

export function useCreateBranchCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, ...data }: CreateBranchCalendarInput & { branchId: string }) => {
      const res = await apiClient.post(`/payments/branches/${branchId}/calendar`, {
        label: data.label,
        period_start: data.period_start,
        period_end: data.period_end,
        due_date: data.due_date,
        academicYearId: data.academicYearId,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create calendar entry');
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-calendar'] });
    },
  });
}

export function useUpdateBranchCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      branchId,
      id,
      ...data
    }: UpdateBranchCalendarInput & { branchId: string; id: string }) => {
      const res = await apiClient.put(`/payments/branches/${branchId}/calendar/${id}`, {
        label: data.label,
        period_start: data.period_start,
        period_end: data.period_end,
        due_date: data.due_date,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to update calendar entry');
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-calendar'] });
    },
  });
}

export function useDeleteBranchCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, id }: { branchId: string; id: string }) => {
      const res = await apiClient.delete(`/payments/branches/${branchId}/calendar/${id}`);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to delete calendar entry');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-calendar'] });
    },
  });
}
