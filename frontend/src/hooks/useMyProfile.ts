import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

/** "Mon profil": the signed-in account's own names, phone and photo. */
export interface MyProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
}

const KEY = ['my-profile'];

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, user?.id],
    queryFn: async () => {
      const res = await apiClient.get<MyProfile>('/users/me/profile');
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load profile');
      return res.data;
    },
    enabled: !!user,
    // The photo's address stays valid an hour.
    staleTime: 30 * 60 * 1000,
  });
}

/** Saves the answer, and the names shown in the menu follow at once. */
function useSaveProfile<T>(send: (input: T) => Promise<MyProfile>) {
  const queryClient = useQueryClient();
  const { user, updateNames } = useAuth();
  return useMutation({
    mutationFn: send,
    onSuccess: (profile) => {
      queryClient.setQueryData([...KEY, user?.id], profile);
      updateNames(profile.firstName, profile.lastName);
    },
  });
}

export function useUpdateMyProfile() {
  return useSaveProfile(async (input: { firstName: string; lastName: string; phone: string | null }) => {
    const res = await apiClient.patch<MyProfile>('/users/me/profile', input);
    if (!res.success || !res.data) throw apiError(res.error, 'Failed to update profile');
    return res.data;
  });
}

export function useUploadMyAvatar() {
  return useSaveProfile(async (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    const res = await apiClient.uploadFile<MyProfile>('/users/me/avatar', form);
    if (!res.success || !res.data) throw apiError(res.error, 'Failed to upload photo');
    return res.data;
  });
}

export function useRemoveMyAvatar() {
  return useSaveProfile(async (_: void) => {
    const res = await apiClient.delete<MyProfile>('/users/me/avatar');
    if (!res.success || !res.data) throw apiError(res.error, 'Failed to remove photo');
    return res.data;
  });
}
