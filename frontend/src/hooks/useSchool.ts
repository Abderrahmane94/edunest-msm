import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export interface School {
  id: string;
  name: string;
  school_type: string;
  address: string;
  wilaya: string;
  contact_email: string;
  contact_phone: string;
  logo_url?: string;
  is_active: boolean;
}

function mapSchool(raw: Record<string, unknown>): School {
  return {
    id: raw.id as string,
    name: raw.name as string,
    school_type: (raw.schoolType ?? raw.school_type) as string,
    address: raw.address as string,
    wilaya: raw.wilaya as string,
    contact_email: (raw.contactEmail ?? raw.contact_email) as string,
    contact_phone: (raw.contactPhone ?? raw.contact_phone) as string,
    logo_url: (raw.logoPublicId ?? raw.logo_url) as string | undefined,
    is_active: (raw.isActive ?? raw.is_active) as boolean,
  };
}

export function useSchool() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['school', user?.schoolId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(`/schools/${user!.schoolId}`);
      if (res.data && typeof res.data === 'object') {
        return mapSchool(res.data as Record<string, unknown>);
      }
      return null;
    },
    enabled: !!user?.schoolId,
  });
}

export function useUpdateSchool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<School>) => {
      // Map to camelCase for the backend
      const body: Record<string, unknown> = {};
      if (data.name !== undefined) body.name = data.name;
      if (data.school_type !== undefined) body.schoolType = data.school_type;
      if (data.address !== undefined) body.address = data.address;
      if (data.wilaya !== undefined) body.wilaya = data.wilaya;
      if (data.contact_email !== undefined) body.contactEmail = data.contact_email;
      if (data.contact_phone !== undefined) body.contactPhone = data.contact_phone;

      const res = await apiClient.put(`/schools/${user!.schoolId}`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school'] });
    },
  });
}
