import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  classroom_id?: string;
  classroom_name?: string;
  published_at: string;
  created_by_name: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  location?: string;
  requires_consent: boolean;
  consent_stats?: {
    total: number;
    approved: number;
    declined: number;
    pending: number;
  };
}

export interface ConsentEntry {
  child_id: string;
  child_name: string;
  status: 'pending' | 'approved' | 'declined';
  responded_at?: string;
}

// ─── Response mappers ────────────────────────────────────────────────────────

function mapAnnouncement(raw: Record<string, unknown>): Announcement {
  const createdBy = raw.createdBy as Record<string, string> | undefined;
  return {
    id: raw.id as string,
    title: raw.title as string,
    // backend field is "content", frontend interface uses "body"
    body: (raw.content ?? raw.body ?? '') as string,
    classroom_id: (raw.classroomId ?? raw.classroom_id) as string | undefined,
    classroom_name: raw.classroom_name as string | undefined,
    published_at: (raw.publishedAt ?? raw.published_at ?? '') as string,
    created_by_name: createdBy
      ? `${createdBy.firstName} ${createdBy.lastName}`.trim()
      : (raw.created_by_name as string) ?? '',
  };
}

function mapEvent(raw: Record<string, unknown>): SchoolEvent {
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: (raw.description ?? '') as string,
    start_datetime: (raw.startDatetime ?? raw.start_datetime ?? '') as string,
    end_datetime: (raw.endDatetime ?? raw.end_datetime ?? '') as string,
    location: raw.location as string | undefined,
    requires_consent: (raw.requiresConsent ?? raw.requires_consent ?? false) as boolean,
    consent_stats: raw.consent_stats as SchoolEvent['consent_stats'] | undefined,
  };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>('/communication/announcements');
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load announcements');
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : [];
      return list.map(mapAnnouncement);
    },
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: ['announcements', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/communication/announcements/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Not found');
      return mapAnnouncement(res.data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/communication/announcements/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete announcement');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/communication/events/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Not found');
      return mapEvent(res.data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/communication/events/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete event');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; body: string; classroom_id?: string }) => {
      // Map to camelCase for the backend
      const body: Record<string, unknown> = {
        title: data.title,
        content: data.body,           // frontend "body" → backend "content"
      };
      if (data.classroom_id) body.classroomId = data.classroom_id;

      const res = await apiClient.post('/communication/announcements', body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create announcement');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>('/communication/events');
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load events');
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : [];
      return list.map(mapEvent);
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      start_datetime: string;
      end_datetime: string;
      location?: string;
      requires_consent: boolean;
    }) => {
      // Map to camelCase for the backend
      const body: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        startDatetime: data.start_datetime,    // snake_case → camelCase
        endDatetime: data.end_datetime,
        requiresConsent: data.requires_consent,
      };
      if (data.location) body.location = data.location;

      const res = await apiClient.post('/communication/events', body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create event');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useEventConsent(eventId?: string) {
  return useQuery({
    queryKey: ['event-consent', eventId],
    queryFn: async () => {
      const res = await apiClient.get<{ consents: ConsentEntry[] }>(`/communication/events/${eventId}/consent`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load consent data');
      return res.data?.consents ?? [];
    },
    enabled: !!eventId,
  });
}
