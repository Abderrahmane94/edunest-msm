import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StaffColleague {
  id: string;
  firstName: string;
  lastName: string;
  role: 'teacher' | 'admin';
}

export interface StaffConversation {
  id: string;
  school_id: string;
  initiator_id: string;
  recipient_id: string;
  created_at: string;
  last_message_at: string;
  initiator: StaffColleague;
  recipient: StaffColleague;
  unread_count: number;
  last_message?: string | null;
}

export interface StaffMessage {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  content: string | null;
  message_type: 'text' | 'photo' | 'document';
  cloudinary_public_id?: string;
  file_url?: string;
  is_read: boolean;
  created_at: string;
  sender: StaffColleague;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapColleague(raw: Record<string, unknown>): StaffColleague {
  return {
    id: raw.id as string,
    firstName: (raw.firstName ?? raw.first_name) as string,
    lastName: (raw.lastName ?? raw.last_name) as string,
    role: raw.role as 'teacher' | 'admin',
  };
}

function mapConversation(raw: Record<string, unknown>): StaffConversation {
  const initiator = raw.initiator as Record<string, unknown>;
  const recipient = raw.recipient as Record<string, unknown>;
  return {
    id: raw.id as string,
    school_id: (raw.schoolId ?? raw.school_id) as string,
    initiator_id: (raw.initiatorId ?? raw.initiator_id) as string,
    recipient_id: (raw.recipientId ?? raw.recipient_id) as string,
    created_at: (raw.createdAt ?? raw.created_at ?? '') as string,
    last_message_at: (raw.lastMessageAt ?? raw.last_message_at ?? '') as string,
    initiator: mapColleague(initiator),
    recipient: mapColleague(recipient),
    unread_count: (raw.unreadCount ?? raw.unread_count ?? 0) as number,
    last_message: (raw.lastMessage ?? raw.last_message ?? null) as string | null,
  };
}

function mapMessage(raw: Record<string, unknown>): StaffMessage {
  const sender = raw.sender as Record<string, unknown>;
  return {
    id: raw.id as string,
    conversation_id: (raw.conversationId ?? raw.conversation_id) as string,
    sender_user_id: (raw.senderUserId ?? raw.sender_user_id) as string,
    content: (raw.content ?? null) as string | null,
    message_type: (raw.messageType ?? raw.message_type ?? 'text') as 'text' | 'photo' | 'document',
    cloudinary_public_id: (raw.cloudinaryPublicId ?? raw.cloudinary_public_id) as string | undefined,
    file_url: (raw.mediaUrl ?? raw.file_url) as string | undefined,
    is_read: (raw.isRead ?? raw.is_read ?? false) as boolean,
    created_at: (raw.createdAt ?? raw.created_at ?? '') as string,
    sender: mapColleague(sender),
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** List all staff colleagues (teachers + admins) in the same school. */
export function useStaffColleagues() {
  return useQuery({
    queryKey: ['staff-colleagues'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/communication/staff/colleagues');
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw.map((c: Record<string, unknown>) => mapColleague(c)) as StaffColleague[];
    },
  });
}

/** List staff conversations for the current user. */
export function useStaffConversations() {
  return useQuery({
    queryKey: ['staff-conversations'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/communication/staff/conversations');
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw.map((c: Record<string, unknown>) => mapConversation(c)) as StaffConversation[];
    },
  });
}

/** Get messages in a staff conversation. */
export function useStaffMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['staff-messages', conversationId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/communication/staff/conversations/${conversationId}/messages`,
      );
      const raw = Array.isArray(res.data) ? res.data : [];
      const mapped = raw.map((m: Record<string, unknown>) => mapMessage(m)) as StaffMessage[];
      // API returns newest-first; reverse for display order (oldest at top)
      return mapped.reverse();
    },
    enabled: !!conversationId,
  });
}

/** Get or create a staff conversation with a colleague. */
export function useGetOrCreateStaffConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiClient.post<{ conversation: Record<string, unknown> }>(
        '/communication/staff/conversations',
        { targetUserId },
      );
      if (!res.success) throw new Error(res.error?.message || 'Failed to create conversation');
      const data = res.data as { conversation: Record<string, unknown> };
      return mapConversation(data.conversation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-conversations'] });
    },
  });
}

/** Send a text message in a staff conversation. */
export function useSendStaffMessage(conversationId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content: string; message_type?: 'text' }) => {
      const res = await apiClient.post<StaffMessage>(
        `/communication/staff/conversations/${conversationId}/messages`,
        { content: data.content, messageType: data.message_type || 'text' },
      );
      if (!res.success) throw new Error(res.error?.message || 'Failed to send message');
      return res.data as StaffMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['staff-conversations'] });
    },
  });
}

/** Send a file (photo/document) in a staff conversation. */
export function useSendStaffFileMessage(conversationId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, messageType }: { file: File; messageType: 'photo' | 'document' }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('message_type', messageType);
      const res = await apiClient.uploadFile(
        `/communication/staff/conversations/${conversationId}/messages/file`,
        formData,
      );
      if (!res.success) throw new Error(res.error?.message || 'Failed to send file');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['staff-conversations'] });
    },
  });
}

/** Mark a staff message as read. */
export function useMarkStaffMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiClient.patch(`/communication/staff/messages/${messageId}/read`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to mark as read');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-conversations'] });
    },
  });
}
