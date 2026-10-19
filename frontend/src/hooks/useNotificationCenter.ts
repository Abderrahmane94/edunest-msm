import { useQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient, type ApiResponse, apiError } from '@/lib/api-client';

export type NotificationType =
  | 'absence_alert'
  | 'payment_received'
  | 'payment_overdue'
  | 'invoice_sent'
  | 'daily_report'
  | 'message_new'
  | 'announcement'
  | 'event_consent'
  | 'substitution';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}

interface NotificationsPage {
  items: AppNotification[];
  page: number;
  totalPages: number;
  /** All the user's notifications, read or not. */
  total: number;
}

const PAGE_SIZE = 20;

function normalize(raw: Record<string, unknown>): AppNotification {
  return {
    id: raw.id as string,
    type: raw.type as NotificationType,
    title: raw.title as string,
    body: raw.body as string,
    is_read: (raw.isRead ?? raw.is_read ?? false) as boolean,
    reference_id: (raw.referenceId ?? raw.reference_id) as string | undefined,
    reference_type: (raw.referenceType ?? raw.reference_type) as string | undefined,
    created_at: (raw.createdAt ?? raw.created_at ?? '') as string,
  };
}

/**
 * Paginated notification list with "load more" support, mirroring the
 * social-media feed pattern. Backed by GET /api/notifications.
 */
export function useNotificationsInfinite() {
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<NotificationsPage> => {
      const res = (await apiClient.get<Record<string, unknown>[]>(
        `/notifications?page=${pageParam}&pageSize=${PAGE_SIZE}`,
      )) as ApiResponse<Record<string, unknown>[]>;
      const items = Array.isArray(res.data) ? res.data.map(normalize) : [];
      const totalPages = res.meta?.totalPages ?? 1;
      return { items, page: pageParam as number, totalPages, total: res.meta?.total ?? items.length };
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

/** Live unread count, polled as a fallback and refreshed on socket events. */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return res.data?.count ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch(`/notifications/${id}/read`);
      if (!res.success) throw apiError(res.error, 'Failed to mark as read');
      return id;
    },
    onSuccess: (id) => {
      // Optimistically flip the item in the cached list.
      qc.setQueryData<InfiniteData<NotificationsPage>>(['notifications', 'list'], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
          })),
        };
      });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch('/notifications/read-all');
      if (!res.success) throw apiError(res.error, 'Failed to mark all as read');
    },
    onSuccess: () => {
      qc.setQueryData<InfiniteData<NotificationsPage>>(['notifications', 'list'], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((n) => ({ ...n, is_read: true })),
          })),
        };
      });
      qc.setQueryData(['notifications', 'unread-count'], 0);
    },
  });
}

/** Takes notifications out of the list already shown, without reloading it. */
function dropFromList(qc: ReturnType<typeof useQueryClient>, keep: (n: AppNotification) => boolean) {
  qc.setQueryData<InfiniteData<NotificationsPage>>(['notifications', 'list'], (data) => {
    if (!data) return data;
    const removed = data.pages.reduce((sum, p) => sum + p.items.filter((n) => !keep(n)).length, 0);
    return {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.filter(keep), total: Math.max(0, p.total - removed) })),
    };
  });
}

/** Removes one notification (only the alert: what it points to stays). */
export function useRemoveNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/notifications/${id}`);
      if (!res.success) throw apiError(res.error, 'Failed to remove the notification');
    },
    onSuccess: (_, id) => {
      dropFromList(qc, (n) => n.id !== id);
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

/** Removes the read notifications, never one not seen yet. */
export function useClearReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete('/notifications/read');
      if (!res.success) throw apiError(res.error, 'Failed to clear the notifications');
    },
    onSuccess: () => {
      dropFromList(qc, (n) => !n.is_read);
      // Older pages not loaded yet may hold more: load them afresh.
      qc.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}
