import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface ClassroomWorkingDays {
  id: string;
  name: string;
  workingDays: DayOfWeek[];
}

export function useWorkingDays(classroomId: string | undefined) {
  return useQuery({
    queryKey: ['working-days', classroomId],
    queryFn: async () => {
      const res = await apiClient.get<ClassroomWorkingDays>(`/timetable/${classroomId}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load working days');
      return res.data!;
    },
    enabled: !!classroomId,
  });
}

export function useUpdateWorkingDays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { classroomId: string; workingDays: DayOfWeek[] }) => {
      const res = await apiClient.put<ClassroomWorkingDays>('/timetable', data);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update working days');
      return res.data!;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['working-days', variables.classroomId] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}
