import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useMemo } from 'react';
import { useCurrentTeacherClass } from '@/hooks/useSubstitutions';

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
 * The class the teacher works with now: their own class of the current
 * year, or one they replace today (chosen with the class switcher when they
 * have several).
 */
export function useTeacherClassroom() {
  const query = useCurrentTeacherClass();
  const c = query.current;
  const data = useMemo<TeacherClassroom | null | undefined>(
    () =>
      c
        ? { id: c.id, name: c.name, level: c.level ?? '', capacity: c.capacity, academic_year_id: c.academicYearId }
        : query.isLoading
          ? undefined
          : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c?.id, c?.name, query.isLoading],
  );
  return { ...query, data };
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
