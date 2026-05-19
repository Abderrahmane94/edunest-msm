import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export interface SchoolItem {
  id: string;
  name: string;
  address: string;
  wilaya: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
}

export function useSchoolsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['schools-list'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/schools');
      const raw = res.data;
      if (Array.isArray(raw)) return raw as SchoolItem[];
      if (raw && typeof raw === 'object' && 'schools' in (raw as object)) {
        return (raw as { schools: SchoolItem[] }).schools;
      }
      return [];
    },
    enabled: user?.role === 'super_admin',
  });
}
