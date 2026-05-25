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

export function useTrashList(entityType: TrashEntityType, page = 1, pageSize = 20, enabled = true) {
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  return useQuery({
    queryKey: ['trash', entityType, { page, pageSize }],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number }>(
        `/trash/${entityType}?${queryParams.toString()}`,
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load trash items');
      const raw = res.data as { items: Record<string, unknown>[]; total: number; page: number; pageSize: number };

      // Map raw API items to TrashItem shape
      const items: TrashItem[] = raw.items.map((item) => ({
        id: item.id as string,
        deletedAt: item.deletedAt as string,
        displayName: getDisplayName(entityType, item),
        entityType,
        metadata: item,
      }));

      return { items, total: raw.total, page: raw.page, pageSize: raw.pageSize } as TrashListResponse;
    },
  });
}

function getDisplayName(entityType: TrashEntityType, item: Record<string, unknown>): string {
  switch (entityType) {
    case 'schools':
      return (item.name as string) ?? '—';
    case 'users':
      return `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || '—';
    case 'children':
      return `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || '—';
    case 'classrooms':
      return (item.name as string) ?? '—';
  }
}

const ENTITY_LIST_KEYS: Record<TrashEntityType, string[]> = {
  schools: ['schools-list'],
  users: ['users'],
  children: ['children'],
  classrooms: ['classrooms'],
};

export function useRestoreRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityType, id }: { entityType: TrashEntityType; id: string }) => {
      const res = await apiClient.post(`/trash/${entityType}/${id}/restore`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to restore record');
      return res.data;
    },
    onSuccess: (_data, { entityType }) => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ENTITY_LIST_KEYS[entityType] });
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
