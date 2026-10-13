import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, apiError } from '@/lib/api-client';

/** The school office: the director (admin), the office staff (administrative), or super_admin. */
export function isOfficeRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'administrative' || role === 'super_admin';
}

export const AREAS = [
  'children',
  'classes',
  'communication',
  'inventory',
  'documents',
  'collections',
  'expenses',
  'fees',
  'payroll',
  'staff',
  'settings',
] as const;
export type Area = (typeof AREAS)[number];
export type Level = 'none' | 'view' | 'edit';

export interface Permissions {
  areas: Record<Area, Level>;
  delete: boolean;
  correctPayments: boolean;
  collectCash: boolean;
}

/**
 * The signed-in user's rights. The director has them all; the office staff
 * have their profile's (the server checks every action the same way); others
 * have none here — teachers and parents keep their own pages.
 */
export function usePermissions() {
  const { user } = useAuth();
  const isDirector = user?.role === 'admin' || user?.role === 'super_admin';
  const query = useQuery({
    queryKey: ['my-permissions', user?.id],
    enabled: user?.role === 'administrative',
    // A change made by the director shows within a minute (the server applies it at once).
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await apiClient.get<{ permissions: Permissions }>('/access-profiles/me');
      if (!res.success) throw apiError(res.error, 'Failed to load rights');
      return (res.data as { permissions: Permissions }).permissions;
    },
  });
  const p = query.data;
  const can = (area: Area, level: Exclude<Level, 'none'> = 'view'): boolean => {
    if (isDirector) return true;
    const have = p?.areas[area];
    return level === 'view' ? have === 'view' || have === 'edit' : have === 'edit';
  };
  return {
    can,
    canDelete: isDirector || !!p?.delete,
    canCorrectPayments: isDirector || !!p?.correctPayments,
    /** Count and take the money of the others' cash desks. */
    canCollectCash: isDirector || !!p?.collectCash,
    isDirector,
    /** Rights are known (always for the director). */
    ready: isDirector || !!p || user?.role !== 'administrative',
  };
}

/** Whether the user is the director (or super_admin): profiles and director accounts are theirs only. */
export function useIsDirector(): boolean {
  const { user } = useAuth();
  return user?.role === 'admin' || user?.role === 'super_admin';
}
