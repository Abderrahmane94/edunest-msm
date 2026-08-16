import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Conversation {
  id: string;
  child_id: string;
  child_name: string;
  teacher_user_id: string;
  parent_user_id: string;
  parent_name: string;
  last_message?: string;
  last_message_at: string;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  content: string | null;
  message_type: 'text' | 'photo' | 'document';
  cloudinary_public_id?: string;
  file_url?: string;
  is_read: boolean;
  created_at: string;
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/communication/conversations');
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw.map((c: Record<string, unknown>) => {
        const parent = c.parent as Record<string, unknown> | undefined;
        const child = c.child as Record<string, unknown> | undefined;
        const parentName = parent ? `${parent.firstName} ${parent.lastName}` : (c.parentName ?? c.parent_name ?? '') as string;
        const childName = child ? `${child.firstName} ${child.lastName}` : (c.childName ?? c.child_name ?? '') as string;

        return {
          id: c.id as string,
          child_id: (c.childId ?? c.child_id) as string,
          child_name: childName,
          teacher_user_id: (c.teacherUserId ?? c.teacher_user_id) as string,
          parent_user_id: (c.parentUserId ?? c.parent_user_id) as string,
          parent_name: parentName,
          last_message: (c.lastMessage ?? c.last_message) as string | undefined,
          last_message_at: (c.lastMessageAt ?? c.last_message_at ?? '') as string,
          unread_count: (c.unreadCount ?? c.unread_count ?? 0) as number,
        };
      }) as Conversation[];
    },
  });
}

export function useMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/communication/conversations/${conversationId}/messages`
      );
      const raw = Array.isArray(res.data) ? res.data : [];
      const mapped = raw.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        conversation_id: (m.conversationId ?? m.conversation_id) as string,
        sender_user_id: (m.senderUserId ?? m.sender_user_id) as string,
        content: (m.content ?? null) as string | null,
        message_type: (m.messageType ?? m.message_type ?? 'text') as 'text' | 'photo' | 'document',
        cloudinary_public_id: (m.cloudinaryPublicId ?? m.cloudinary_public_id) as string | undefined,
        file_url: (m.fileUrl ?? m.file_url) as string | undefined,
        is_read: (m.isRead ?? m.is_read ?? false) as boolean,
        created_at: (m.createdAt ?? m.created_at ?? '') as string,
      })) as Message[];
      // The API returns newest-first (efficient for "give me the latest page"),
      // but the chat UI displays oldest-to-newest top-to-bottom, auto-scrolled
      // to the bottom — reverse here so every consumer gets display order.
      return mapped.reverse();
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { content: string; message_type: 'text' | 'photo' | 'document' }) => {
      const res = await apiClient.post<Message>(
        `/communication/conversations/${conversationId}/messages`,
        { content: data.content, messageType: data.message_type }
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to send message');
      }
      return res.data as Message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiClient.patch(`/communication/messages/${messageId}/read`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to mark message as read');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { childId: string; parentUserId?: string }) => {
      const res = await apiClient.post<{ conversation: Conversation }>('/communication/conversations', data);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create conversation');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendFileMessage(conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, messageType }: { file: File; messageType: 'photo' | 'document' }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('message_type', messageType);

      const res = await apiClient.uploadFile(`/communication/conversations/${conversationId}/messages`, formData);
      if (!res.success) throw new Error(res.error?.message || 'Failed to send file message');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
