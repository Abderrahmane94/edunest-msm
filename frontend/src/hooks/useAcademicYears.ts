import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

function mapAcademicYear(raw: Record<string, unknown>): AcademicYear {
  return {
    id: raw.id as string,
    name: raw.name as string,
    start_date: (raw.startDate ?? raw.start_date) as string,
    end_date: (raw.endDate ?? raw.end_date) as string,
    is_active: (raw.isActive ?? raw.is_active) as boolean,
    created_at: (raw.createdAt ?? raw.created_at) as string,
  };
}

export function useAcademicYears() {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/academic-years');
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((item) => mapAcademicYear(item as Record<string, unknown>));
      }
      if (raw && typeof raw === 'object' && 'academicYears' in (raw as object)) {
        return ((raw as { academicYears: Record<string, unknown>[] }).academicYears).map(mapAcademicYear);
      }
      return [];
    },
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; start_date: string; end_date: string }) => {
      const res = await apiClient.post('/academic-years', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });
}

export function useActivateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch(`/academic-years/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });
}
