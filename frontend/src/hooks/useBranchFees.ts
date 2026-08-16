import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BranchFee {
  id: string;
  branchId: string;
  name: string;
  amount: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchFeeInput {
  name: string;
  amount: number;
}

export interface UpdateBranchFeeInput {
  name?: string;
  amount?: number;
  isActive?: boolean;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all fees for a branch.
 */
export function useBranchFees(branchId: string, includeInactive = false) {
  return useQuery({
    queryKey: ['branch-fees', branchId, includeInactive],
    queryFn: async () => {
      const url = includeInactive
        ? `/payments/branches/${branchId}/fees?all=true`
        : `/payments/branches/${branchId}/fees`;
      const res = await apiClient.get<unknown>(url);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch fees');
      }
      return (res.data as BranchFee[]) ?? [];
    },
    enabled: !!branchId,
  });
}

/**
 * Create a new fee for a branch.
 */
export function useCreateBranchFee(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBranchFeeInput) => {
      const res = await apiClient.post<unknown>(
        `/payments/branches/${branchId}/fees`,
        data,
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create fee');
      }
      return res.data as BranchFee;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-fees', branchId] });
    },
  });
}

/**
 * Update a fee.
 */
export function useUpdateBranchFee(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateBranchFeeInput & { id: string }) => {
      const res = await apiClient.put<unknown>(
        `/payments/branches/${branchId}/fees/${id}`,
        data,
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to update fee');
      }
      return res.data as BranchFee;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-fees', branchId] });
    },
  });
}

/**
 * Deactivate (soft delete) a fee.
 */
export function useDeleteBranchFee(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<unknown>(
        `/payments/branches/${branchId}/fees/${id}`,
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to delete fee');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-fees', branchId] });
    },
  });
}

/**
 * Apply a fee to an enrollment.
 */
export function useApplyFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ enrollmentId, branchFeeId }: { enrollmentId: string; branchFeeId: string }) => {
      const res = await apiClient.post<unknown>(
        `/payments/enrollments/${enrollmentId}/apply-fee`,
        { branchFeeId },
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to apply fee');
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-billing-periods'] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export interface AssignFeeInput {
  target: 'children' | 'classrooms' | 'school';
  childIds?: string[];
  classroomIds?: string[];
}

export interface AssignFeeResult {
  applied: number;
  skipped: number;
  total: number;
}

/**
 * Batch-assign a fee to children, classrooms, or the whole school.
 */
export function useAssignFee(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feeId, ...data }: AssignFeeInput & { feeId: string }): Promise<AssignFeeResult> => {
      const res = await apiClient.post<unknown>(
        `/payments/branches/${branchId}/fees/${feeId}/assign`,
        data,
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to assign fee');
      }
      return res.data as AssignFeeResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-billing-periods'] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}
