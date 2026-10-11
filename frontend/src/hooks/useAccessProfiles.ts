import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import type { Permissions } from '@/lib/roles';

export interface AccessProfile {
  id: string;
  name: string;
  description: string | null;
  permissions: Permissions;
  isDefault: boolean;
  users: { id: string; firstName: string; lastName: string; isActive: boolean }[];
}

export interface AccessProfileInput {
  name: string;
  description?: string | null;
  permissions: Permissions;
}

export function useAccessProfiles(enabled = true) {
  return useQuery({
    queryKey: ['access-profiles'],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<AccessProfile[]>('/access-profiles');
      if (!res.success) throw apiError(res.error, 'Failed to load profiles');
      return res.data as AccessProfile[];
    },
  });
}

function useProfileMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['access-profiles'] });
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useSaveAccessProfile() {
  return useProfileMutation(async ({ id, ...input }: Partial<AccessProfileInput> & { id?: string; isDefault?: true }) => {
    const res = id ? await apiClient.put(`/access-profiles/${id}`, input) : await apiClient.post('/access-profiles', input);
    if (!res.success) throw apiError(res.error, 'Failed to save the profile');
    return res.data;
  });
}

export function useDeleteAccessProfile() {
  return useProfileMutation(async (id: string) => {
    const res = await apiClient.delete(`/access-profiles/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to delete the profile');
    return res.data;
  });
}

export function useAssignAccessProfile() {
  return useProfileMutation(async ({ userId, profileId }: { userId: string; profileId: string }) => {
    const res = await apiClient.put(`/access-profiles/users/${userId}`, { profileId });
    if (!res.success) throw apiError(res.error, 'Failed to assign the profile');
    return res.data;
  });
}
