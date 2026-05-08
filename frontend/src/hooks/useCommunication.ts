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

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await apiClient.get<{ announcements: Announcement[] }>('/communication/announcements');
      return res.data?.announcements ?? [];
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; body: string; classroom_id?: string }) => {
      const res = await apiClient.post('/communication/announcements', data);
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
      const res = await apiClient.get<{ events: SchoolEvent[] }>('/communication/events');
      return res.data?.events ?? [];
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description: string; start_datetime: string; end_datetime: string; location?: string; requires_consent: boolean }) => {
      const res = await apiClient.post('/communication/events', data);
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
      return res.data?.consents ?? [];
    },
    enabled: !!eventId,
  });
}
