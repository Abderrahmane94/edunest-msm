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

export function useAcademicYear(id: string) {
  return useQuery({
    queryKey: ['academic-years', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/academic-years/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Not found');
      return mapAcademicYear(res.data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; start_date?: string; end_date?: string }) => {
      const body: Record<string, unknown> = {};
      if (data.name !== undefined) body.name = data.name;
      if (data.start_date !== undefined) body.startDate = data.start_date;
      if (data.end_date !== undefined) body.endDate = data.end_date;
      const res = await apiClient.put(`/academic-years/${id}`, body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update academic year');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['academic-years', variables.id] });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/academic-years/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete academic year');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; start_date: string; end_date: string }) => {
      const res = await apiClient.post('/academic-years', {
        name: data.name,
        startDate: data.start_date,
        endDate: data.end_date,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create academic year');
      }
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
