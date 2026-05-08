import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherClassroom {
  id: string;
  name: string;
  level: string;
  capacity: number;
  academic_year_id: string;
}

export interface ClassroomChild {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
}

/**
 * Fetches the classroom assigned to the current teacher.
 * Uses the classrooms endpoint filtered by the teacher's user ID.
 */
export function useTeacherClassroom() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-classroom', user?.id],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/classrooms?teacher_id=${user?.id}`
      );
      const raw = res.data;
      let classrooms: Record<string, unknown>[] = [];

      if (Array.isArray(raw)) {
        classrooms = raw;
      } else if (raw && typeof raw === 'object' && 'classrooms' in (raw as object)) {
        classrooms = (raw as { classrooms: Record<string, unknown>[] }).classrooms;
      }

      if (classrooms.length === 0) return null;

      const c = classrooms[0];
      return {
        id: c.id as string,
        name: c.name as string,
        level: (c.level ?? '') as string,
        capacity: c.capacity as number,
        academic_year_id: (c.academicYearId ?? c.academic_year_id) as string,
      } as TeacherClassroom;
    },
    enabled: !!user?.id && user?.role === 'teacher',
  });
}

/**
 * Fetches children enrolled in a specific classroom.
 */
export function useClassroomChildren(classroomId: string | undefined) {
  return useQuery({
    queryKey: ['classroom-children', classroomId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/children?classroom_id=${classroomId}&pageSize=100`
      );
      const raw = res.data;
      let children: Record<string, unknown>[] = [];

      if (Array.isArray(raw)) {
        children = raw;
      } else if (raw && typeof raw === 'object' && 'children' in (raw as object)) {
        children = (raw as { children: Record<string, unknown>[] }).children;
      }

      return children.map((c) => ({
        id: c.id as string,
        first_name: (c.firstName ?? c.first_name) as string,
        last_name: (c.lastName ?? c.last_name) as string,
        photo_url: (c.photoUrl ?? c.photo_url ?? null) as string | null,
      })) as ClassroomChild[];
    },
    enabled: !!classroomId,
  });
}
