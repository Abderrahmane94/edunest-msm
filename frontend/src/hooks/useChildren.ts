import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Child {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  enrollment_date: string;
  photo_url?: string;
  is_active: boolean;
  classroom_name?: string;
  parent_names?: string[];
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  is_authorized_pickup: boolean;
}

interface ChildrenParams {
  page?: number;
  pageSize?: number;
  search?: string;
  classroomId?: string;
}

export function useChildren(params: ChildrenParams = {}) {
  const { page = 1, pageSize = 10, search, classroomId } = params;
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (search) queryParams.set('search', search);
  if (classroomId) queryParams.set('classroom_id', classroomId);

  return useQuery({
    queryKey: ['children', params],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(`/children?${queryParams.toString()}`);
      const raw = res.data;
      let children: Child[] = [];
      let total = 0;

      if (Array.isArray(raw)) {
        children = raw.map((c) => mapChild(c as Record<string, unknown>));
        total = (res.meta as { pagination?: { total?: number } })?.pagination?.total ?? children.length;
      } else if (raw && typeof raw === 'object' && 'children' in (raw as object)) {
        const wrapped = raw as { children: Record<string, unknown>[]; total: number };
        children = wrapped.children.map(mapChild);
        total = wrapped.total;
      }

      return { children, total };
    },
  });
}

function mapChild(raw: Record<string, unknown>): Child {
  const enrollments = raw.enrollments as { classroom?: { name?: string } }[] | undefined;
  const classroomName = enrollments?.[0]?.classroom?.name;

  return {
    id: raw.id as string,
    first_name: (raw.firstName ?? raw.first_name) as string,
    last_name: (raw.lastName ?? raw.last_name) as string,
    date_of_birth: (raw.dateOfBirth ?? raw.date_of_birth) as string,
    gender: raw.gender as string,
    enrollment_date: (raw.enrollmentDate ?? raw.enrollment_date) as string,
    photo_url: (raw.photoPublicId ?? raw.photo_url) as string | undefined,
    is_active: (raw.isActive ?? raw.is_active) as boolean,
    classroom_name: classroomName,
    parent_names: (raw.parent_names ?? []) as string[],
    created_at: (raw.createdAt ?? raw.created_at) as string,
  };
}

export function useCreateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { first_name: string; last_name: string; date_of_birth: string; gender: string; classroom_id?: string }) => {
      const res = await apiClient.post('/children', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
}

export function useLinkParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, parentId, relationship }: { childId: string; parentId: string; relationship: string }) => {
      const res = await apiClient.post(`/children/${childId}/parents`, { parent_id: parentId, relationship });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
}
