import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import type { Permissions } from '@/lib/roles';

export interface AccessProfile {
  id: string;
  name: string;
  description: string | null;
  permissions: Permissions;
  isDefault: boolean;
  users: { id: string; firstName: string; lastName: string; isActive: boolean; hasExceptions: boolean }[];
}

export interface AccessProfileInput {
  name: string;
  description?: string | null;
  permissions: Permissions;
}

export function useAccessProfiles(enabled = true) {
  return useQuery({
    queryKey: ['access-profiles'],
    // Rights change from other screens: always fetched fresh.
    staleTime: 0,
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
      void qc.invalidateQueries({ queryKey: ['access-journal'] });
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

// ─── The journal ───

export interface AccessLogEntry {
  id: string;
  actorName: string;
  action:
    | 'profile_created'
    | 'profile_updated'
    | 'profile_deleted'
    | 'profile_default'
    | 'profile_assigned'
    | 'exception_added'
    | 'exception_removed';
  profileName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  details: {
    changes?: { key: string; from: string; to: string }[];
    from?: string | null;
    to?: string;
    movedTo?: string;
    people?: string[];
    key?: string;
    level?: string;
    endsOn?: string | null;
    note?: string | null;
  };
  createdAt: string;
}

/** Who changed which rights, latest first (all, or about one person). */
export function useAccessJournal(filters: { userId?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ['access-journal', filters.userId ?? null],
    // Rights change from other screens: always fetched fresh.
    staleTime: 0,
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<AccessLogEntry[]>(`/access-profiles/journal${filters.userId ? `?user_id=${filters.userId}` : ''}`);
      if (!res.success) throw apiError(res.error, 'Failed to load the journal');
      return res.data as AccessLogEntry[];
    },
  });
}

// ─── Per-person exceptions ───

/** An area, or one of the separate rights. */
export type ExceptionKey = import('@/lib/roles').Area | 'delete' | 'correctPayments' | 'collectCash';

export interface AccessException {
  id: string;
  area: ExceptionKey;
  level: 'none' | 'view' | 'edit';
  endsOn: string | null;
  note: string | null;
  active: boolean;
  createdAt: string;
}

export function useUserExceptions(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['access-exceptions', userId],
    // Rights change from other screens: always fetched fresh.
    staleTime: 0,
    enabled: enabled && !!userId,
    queryFn: async () => {
      const res = await apiClient.get<AccessException[]>(`/access-profiles/users/${userId}/exceptions`);
      if (!res.success) throw apiError(res.error, 'Failed to load exceptions');
      return res.data as AccessException[];
    },
  });
}

function useExceptionMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['access-exceptions'] });
      void qc.invalidateQueries({ queryKey: ['access-profiles'] });
      void qc.invalidateQueries({ queryKey: ['access-journal'] });
    },
  });
}

export function useSetException() {
  return useExceptionMutation(
    async ({ userId, ...input }: { userId: string; area: ExceptionKey; level: 'none' | 'view' | 'edit'; endsOn?: string | null; note?: string | null }) => {
      const res = await apiClient.put(`/access-profiles/users/${userId}/exceptions`, input);
      if (!res.success) throw apiError(res.error, 'Failed to save the exception');
      return res.data;
    },
  );
}

export function useRemoveException() {
  return useExceptionMutation(async ({ userId, id }: { userId: string; id: string }) => {
    const res = await apiClient.delete(`/access-profiles/users/${userId}/exceptions/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to remove the exception');
    return res.data;
  });
}

