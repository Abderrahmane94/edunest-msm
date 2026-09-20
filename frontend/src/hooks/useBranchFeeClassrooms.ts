import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { BranchFee } from '@/hooks/useBranchFees';

export interface FeeClassroom {
  id: string;
  name: string;
  isLinked: boolean;
}

/**
 * Lists every classroom in the fee's school, flagged with whether it's
 * currently linked to this fee.
 */
export function useFeeClassrooms(branchFeeId: string | undefined) {
  return useQuery({
    queryKey: ['fee-classrooms', branchFeeId],
    queryFn: async () => {
      const res = await apiClient.get<{ classrooms: FeeClassroom[] }>(
        `/payments/fees/${branchFeeId}/classrooms`,
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to load classrooms');
      }
      return res.data?.classrooms ?? [];
    },
    enabled: !!branchFeeId,
  });
}

/**
 * Replaces a fee's classroom links entirely.
 */
export function useSetFeeClassrooms(branchFeeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (classroomIds: string[]) => {
      const res = await apiClient.put<{ classrooms: FeeClassroom[] }>(
        `/payments/fees/${branchFeeId}/classrooms`,
        { classroomIds },
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to save classroom links');
      }
      return res.data?.classrooms ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-classrooms', branchFeeId] });
    },
  });
}

/**
 * Lists active fees applicable to a classroom: fees explicitly linked to it,
 * plus general fees with no classroom links at all.
 */
export function useClassroomFees(classroomId: string | undefined) {
  return useQuery({
    queryKey: ['classroom-fees', classroomId],
    queryFn: async () => {
      const res = await apiClient.get<{ fees: BranchFee[] }>(
        `/payments/classrooms/${classroomId}/fees`,
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to load fees');
      }
      return res.data?.fees ?? [];
    },
    enabled: !!classroomId,
  });
}
