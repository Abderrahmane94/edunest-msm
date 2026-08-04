import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface BranchBillingConfig {
  id: string;
  branchId: string;
  billingCycle: 'monthly' | 'trimester' | 'custom';
  billingDueDay: number;
  gracePeriodDays: number;
  defaultRecurringFee: string; // Decimal string from API
  notificationSetting: 'enabled' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface BranchBillingConfigInput {
  billingCycle: 'monthly' | 'trimester' | 'custom';
  billingDueDay: number;
  gracePeriodDays: number;
  defaultRecurringFee: number;
  notificationSetting: 'enabled' | 'disabled';
}

export interface Branch {
  id: string;
  schoolId: string;
  name: string;
  address?: string;
  isActive: boolean;
}

// ─── Fetch branches for the current school ────────────────────────────────────

export function useBranches() {
  return useQuery({
    queryKey: ['payment-branches'],
    queryFn: async () => {
      const res = await apiClient.get<Branch[]>('/payments/branches');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

// ─── Create a branch ──────────────────────────────────────────────────────────

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; address?: string }) => {
      const res = await apiClient.post<Branch>('/payments/branches', data);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create branch');
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-branches'] });
    },
  });
}

// ─── Update a branch ──────────────────────────────────────────────────────────

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, ...data }: { branchId: string; name?: string; address?: string; isActive?: boolean }) => {
      const res = await apiClient.put<Branch>(`/payments/branches/${branchId}`, data);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to update branch');
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-branches'] });
    },
  });
}

// ─── Fetch billing config for a branch ────────────────────────────────────────

export function useBranchBillingConfig(branchId: string | undefined) {
  return useQuery({
    queryKey: ['branch-billing-config', branchId],
    queryFn: async () => {
      const res = await apiClient.get<BranchBillingConfig>(
        `/payments/branches/${branchId}/config`,
      );
      if (!res.success && res.error?.code === 'NOT_FOUND') {
        return null;
      }
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch billing config');
      }
      return res.data ?? null;
    },
    enabled: !!branchId,
  });
}

// ─── Create billing config ────────────────────────────────────────────────────

export function useCreateBranchBillingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      branchId,
      ...data
    }: BranchBillingConfigInput & { branchId: string }) => {
      const res = await apiClient.post<BranchBillingConfig>(
        `/payments/branches/${branchId}/config`,
        data,
      );
      if (!res.success) {
        const err = new Error(res.error?.message ?? 'BILLING_CONFIG_ERROR') as Error & {
          details?: { field: string; message: string }[];
        };
        err.details = res.error?.details;
        throw err;
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['branch-billing-config', variables.branchId] });
    },
  });
}

// ─── Update billing config ────────────────────────────────────────────────────

export function useUpdateBranchBillingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      branchId,
      ...data
    }: Partial<BranchBillingConfigInput> & { branchId: string }) => {
      const res = await apiClient.put<BranchBillingConfig>(
        `/payments/branches/${branchId}/config`,
        data,
      );
      if (!res.success) {
        const err = new Error(res.error?.message ?? 'BILLING_CONFIG_ERROR') as Error & {
          details?: { field: string; message: string }[];
        };
        err.details = res.error?.details;
        throw err;
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['branch-billing-config', variables.branchId] });
    },
  });
}
