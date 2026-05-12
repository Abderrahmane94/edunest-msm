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
      const res = await apiClient.get<Conversation[]>('/communication/conversations');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const res = await apiClient.get<Message[]>(
        `/communication/conversations/${conversationId}/messages`
      );
      return Array.isArray(res.data) ? res.data : [];
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
      const res = await apiClient.put(`/communication/messages/${messageId}/read`);
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

export function useSendFileMessage(conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, messageType }: { file: File; messageType: 'photo' | 'document' }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('message_type', messageType);

      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(
        `${baseUrl}/communication/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send file message');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
