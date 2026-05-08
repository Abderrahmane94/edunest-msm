import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Classroom {
  id: string;
  name: string;
  capacity: number;
  room_number?: string;
  level: string;
  academic_year_id: string;
  teacher_id?: string;
  teacher_name?: string;
  enrolled_count: number;
  created_at: string;
}

export function useClassrooms(academicYearId?: string) {
  const params = academicYearId ? `?academic_year_id=${academicYearId}` : '';
  return useQuery({
    queryKey: ['classrooms', academicYearId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(`/classrooms${params}`);
      const raw = res.data;

      if (Array.isArray(raw)) {
        return raw.map((item) => mapClassroom(item as Record<string, unknown>));
      }
      if (raw && typeof raw === 'object' && 'classrooms' in (raw as object)) {
        return ((raw as { classrooms: Record<string, unknown>[] }).classrooms).map(mapClassroom);
      }
      return [];
    },
  });
}

function mapClassroom(raw: Record<string, unknown>): Classroom {
  const teacher = raw.teacher as Record<string, unknown> | null | undefined;
  return {
    id: raw.id as string,
    name: raw.name as string,
    capacity: raw.capacity as number,
    room_number: (raw.roomNumber ?? raw.room_number) as string | undefined,
    level: raw.level as string,
    academic_year_id: (raw.academicYearId ?? raw.academic_year_id) as string,
    teacher_id: (raw.teacherUserId ?? raw.teacher_id) as string | undefined,
    teacher_name: teacher ? `${teacher.firstName ?? teacher.first_name} ${teacher.lastName ?? teacher.last_name}` : undefined,
    enrolled_count: (raw.enrolled_count ?? raw.enrolledCount ?? 0) as number,
    created_at: (raw.createdAt ?? raw.created_at) as string,
  };
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; capacity: number; room_number?: string; level: string; academic_year_id: string; teacher_id?: string }) => {
      const res = await apiClient.post('/classrooms', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}

export function useAssignTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ classroomId, teacherId }: { classroomId: string; teacherId: string }) => {
      const res = await apiClient.patch(`/classrooms/${classroomId}/assign-teacher`, { teacher_id: teacherId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}
