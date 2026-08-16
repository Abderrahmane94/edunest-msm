import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ContractType = 'full_time' | 'part_time' | 'contract';

export interface StaffProfile {
  id: string;
  user_id: string;
  position: string;
  contract_type: ContractType;
  contract_start: string;
  contract_end: string | null;
  document_public_id: string | null;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
}

// The API returns camelCase fields; map them to the interface the UI expects
function mapStaffProfile(raw: Record<string, unknown>): StaffProfile {
  const user = raw.user as Record<string, unknown> | undefined;
  return {
    id: raw.id as string,
    user_id: (raw.userId ?? raw.user_id) as string,
    position: raw.position as string,
    contract_type: (raw.contractType ?? raw.contract_type) as ContractType,
    contract_start: (raw.contractStart ?? raw.contract_start) as string,
    contract_end: (raw.contractEnd ?? raw.contract_end ?? null) as string | null,
    document_public_id: (raw.documentPublicId ?? raw.document_public_id ?? null) as string | null,
    user: user
      ? {
          id: user.id as string,
          first_name: (user.firstName ?? user.first_name) as string,
          last_name: (user.lastName ?? user.last_name) as string,
          email: user.email as string,
          role: user.role as string,
        }
      : undefined,
  };
}

interface StaffListParams {
  page?: number;
  pageSize?: number;
}

export function useStaffList(params: StaffListParams = {}) {
  const { page = 1, pageSize = 20 } = params;
  return useQuery({
    queryKey: ['staff', params],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(`/staff?page=${page}&pageSize=${pageSize}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load staff');
      const list = Array.isArray(res.data) ? res.data.map(mapStaffProfile) : [];
      const total = (res.meta as { pagination?: { total?: number } })?.pagination?.total ?? list.length;
      return { profiles: list, total };
    },
  });
}

/**
 * Looks up a staff profile by the linked user's ID. Returns `null` (not an
 * error) when the user has no staff profile yet — that's a normal state,
 * distinct from a real failure, and the profile page uses it to decide
 * whether to show a create form or an edit form.
 */
export function useStaffProfileByUserId(userId: string) {
  return useQuery({
    queryKey: ['staff-profile', userId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/staff/by-user/${userId}`);
      if (!res.success) return null;
      return mapStaffProfile(res.data as Record<string, unknown>);
    },
    enabled: !!userId,
  });
}

export function useCreateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      position: string;
      contract_type: ContractType;
      contract_start: string;
      contract_end?: string;
    }) => {
      const res = await apiClient.post('/staff', {
        userId: data.user_id,
        position: data.position,
        contractType: data.contract_type,
        contractStart: data.contract_start,
        contractEnd: data.contract_end || undefined,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create staff profile');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      data,
    }: {
      profileId: string;
      userId: string;
      data: { position?: string; contract_type?: ContractType; contract_start?: string; contract_end?: string | null };
    }) => {
      const body: Record<string, unknown> = {};
      if (data.position !== undefined) body.position = data.position;
      if (data.contract_type !== undefined) body.contractType = data.contract_type;
      if (data.contract_start !== undefined) body.contractStart = data.contract_start;
      if (data.contract_end !== undefined) body.contractEnd = data.contract_end || null;

      const res = await apiClient.put(`/staff/${profileId}`, body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update staff profile');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useUploadStaffDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, file }: { profileId: string; userId: string; file: File }) => {
      const formData = new FormData();
      formData.append('document', file);

      const res = await apiClient.uploadFile(`/staff/${profileId}/document`, formData);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to upload document');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', variables.userId] });
    },
  });
}

export function useDeleteStaffDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId }: { profileId: string; userId: string }) => {
      const res = await apiClient.delete(`/staff/${profileId}/document`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete document');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', variables.userId] });
    },
  });
}

/**
 * Fetches a fresh signed download URL for the staff document on demand
 * (the URL expires, so it isn't cached/embedded ahead of time) and opens it.
 */
export async function openStaffDocument(profileId: string): Promise<void> {
  const res = await apiClient.get<{ url: string }>(`/staff/${profileId}/document-url`);
  if (!res.success || !res.data?.url) {
    throw new Error(res.error?.message ?? 'Failed to get document URL');
  }
  window.open(res.data.url, '_blank', 'noopener,noreferrer');
}
