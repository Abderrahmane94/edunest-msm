import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface StaffProfile {
  id: string;
  user_id: string;
  position: string;
  contract_type: string;
  contract_start: string;
  contract_end?: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
}

export interface StaffDocument {
  id: string;
  name: string;
  public_id: string;
  signed_url?: string;
  uploaded_at: string;
}

export function useStaffProfile(userId: string) {
  return useQuery({
    queryKey: ['staff-profile', userId],
    queryFn: async () => {
      const res = await apiClient.get<StaffProfile>(`/staff/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<StaffProfile> }) => {
      const res = await apiClient.put(`/staff/${userId}`, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', variables.userId] });
    },
  });
}

export function useStaffDocuments(userId: string) {
  return useQuery({
    queryKey: ['staff-documents', userId],
    queryFn: async () => {
      const res = await apiClient.get<StaffDocument[]>(`/staff/${userId}/documents`);
      return res.data ?? [];
    },
    enabled: !!userId,
  });
}

export function useUploadStaffDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const formData = new FormData();
      formData.append('document', file);

      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

      const response = await fetch(`${baseUrl}/staff/${userId}/documents`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-documents', variables.userId] });
    },
  });
}

export function useDeleteStaffDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, documentId }: { userId: string; documentId: string }) => {
      const res = await apiClient.delete(`/staff/${userId}/documents/${documentId}`);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-documents', variables.userId] });
    },
  });
}
