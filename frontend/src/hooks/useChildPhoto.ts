import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

/** A child's photo as the server gives it: a signed link (an hour), and the parents' agreement. */
export interface ChildPhoto {
  id: string;
  photoUrl: string | null;
  photoConsentAt: string | null;
  photoConsentByName: string | null;
}

export interface MyChild extends ChildPhoto {
  firstName: string;
  lastName: string;
}

/** A parent's own children, with their photos. */
export function useMyChildren() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-children'],
    queryFn: async () => {
      const res = await apiClient.get<MyChild[]>('/children/mine');
      if (!res.success) throw apiError(res.error, 'Failed to load your children');
      return res.data ?? [];
    },
    enabled: user?.role === 'parent',
    // The photo links are signed for an hour.
    staleTime: 30 * 60 * 1000,
  });
}

/** Everywhere a child's photo shows, reloaded once it changes. */
function useRefreshPhotos() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['children', 'my-children', 'classroom-children', 'parent-daily-reports', 'parent-attendance']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

/** Sends the photo (already made small) with the parents' agreement. */
export function useUploadChildPhoto(childId: string) {
  const refresh = useRefreshPhotos();
  return useMutation({
    mutationFn: async (photo: Blob) => {
      const form = new FormData();
      form.append('consent', 'true');
      form.append('photo', photo, 'photo.jpg');
      const res = await apiClient.uploadFile<ChildPhoto>(`/children/${childId}/photo`, form);
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to upload photo');
      return res.data;
    },
    onSuccess: refresh,
  });
}

export function useRemoveChildPhoto(childId: string) {
  const refresh = useRefreshPhotos();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ChildPhoto>(`/children/${childId}/photo`);
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to remove photo');
      return res.data;
    },
    onSuccess: refresh,
  });
}
