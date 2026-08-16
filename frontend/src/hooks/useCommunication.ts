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
  classroom_id?: string | null;
  classroom_name?: string | null;
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
  const classroom = raw.classroom as Record<string, string> | null | undefined;
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: (raw.description ?? '') as string,
    start_datetime: (raw.startDatetime ?? raw.start_datetime ?? '') as string,
    end_datetime: (raw.endDatetime ?? raw.end_datetime ?? '') as string,
    location: raw.location as string | undefined,
    requires_consent: (raw.requiresConsent ?? raw.requires_consent ?? false) as boolean,
    classroom_id: (raw.classroomId ?? raw.classroom_id ?? null) as string | null,
    classroom_name: classroom?.name ?? null,
    consent_stats: (raw.consentStats ?? raw.consent_stats) as SchoolEvent['consent_stats'] | undefined,
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
      classroom_id?: string;
    }) => {
      // Map to camelCase for the backend, converting the <input type="datetime-local">
      // value (e.g. "2026-08-20T10:00", no timezone) into a full ISO 8601 UTC string —
      // the backend schema requires z.string().datetime() with a trailing "Z".
      const body: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        startDatetime: new Date(data.start_datetime).toISOString(),
        endDatetime: new Date(data.end_datetime).toISOString(),
        requiresConsent: data.requires_consent,
      };
      if (data.location) body.location = data.location;
      if (data.classroom_id) body.classroomId = data.classroom_id;

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
      // There is no dedicated /consent endpoint — consent forms come embedded
      // in the event detail response, so derive the per-child list from that.
      const res = await apiClient.get<Record<string, unknown>>(`/communication/events/${eventId}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load consent data');
      const forms = (res.data?.consentForms ?? []) as Record<string, unknown>[];
      return forms.map((form): ConsentEntry => {
        const child = form.child as Record<string, string> | undefined;
        return {
          child_id: form.childId as string,
          child_name: child ? `${child.firstName} ${child.lastName}`.trim() : '',
          status: form.status as ConsentEntry['status'],
          responded_at: (form.respondedAt ?? undefined) as string | undefined,
        };
      });
    },
    enabled: !!eventId,
  });
}

// ─── Pending Conversations (Admin supervision) ───────────────────────────────

export interface PendingConversation {
  id: string;
  teacherName: string;
  parentName: string;
  childName: string;
  unreadCount: number;
  lastMessageAt: string;
}

export function usePendingConversations() {
  return useQuery({
    queryKey: ['pending-conversations'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>('/communication/conversations/pending');
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load pending conversations');
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : [];
      return list.map((item): PendingConversation => {
        const teacher = item.teacher as Record<string, string> | undefined;
        const parent = item.parent as Record<string, string> | undefined;
        const child = item.child as Record<string, string> | undefined;
        return {
          id: item.id as string,
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : '',
          parentName: parent ? `${parent.firstName} ${parent.lastName}` : '',
          childName: child ? `${child.firstName} ${child.lastName}` : '',
          unreadCount: (item.unreadCount ?? (item._count as Record<string, number> | undefined)?.messages ?? 0) as number,
          lastMessageAt: (item.lastMessageAt ?? item.waitingSince ?? item.last_message_at ?? '') as string,
        };
      });
    },
  });
}
