import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type TrashEntityType = 'schools' | 'users' | 'children' | 'classrooms';

export interface TrashItem {
  id: string;
  deletedAt: string;
  displayName: string;
  entityType: TrashEntityType;
  metadata: Record<string, unknown>;
}

interface TrashListResponse {
  items: TrashItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function useTrashList(entityType: TrashEntityType, page = 1, pageSize = 20) {
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  return useQuery({
    queryKey: ['trash', entityType, { page, pageSize }],
    queryFn: async () => {
      const res = await apiClient.get<TrashListResponse>(
        `/trash/${entityType}?${queryParams.toString()}`,
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load trash items');
      return res.data as TrashListResponse;
    },
  });
}

export function useRestoreRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityType, id }: { entityType: TrashEntityType; id: string }) => {
      const res = await apiClient.post(`/trash/${entityType}/${id}/restore`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to restore record');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}

export function useHardDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityType, id }: { entityType: TrashEntityType; id: string }) => {
      const res = await apiClient.delete(`/trash/${entityType}/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to permanently delete record');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}
