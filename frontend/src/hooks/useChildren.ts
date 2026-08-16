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
  deleted_at?: string | null;
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
    deleted_at: (raw.deletedAt ?? raw.deleted_at ?? null) as string | null,
  };
}

export function useChild(id: string) {
  return useQuery({
    queryKey: ['children', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/children/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Child not found');
      return mapChild(res.data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; first_name?: string; last_name?: string; date_of_birth?: string; gender?: string; enrollment_date?: string }) => {
      const body: Record<string, unknown> = {};
      if (data.first_name !== undefined) body.firstName = data.first_name;
      if (data.last_name !== undefined) body.lastName = data.last_name;
      if (data.date_of_birth !== undefined) body.dateOfBirth = data.date_of_birth;
      if (data.gender !== undefined) body.gender = data.gender;
      if (data.enrollment_date !== undefined) body.enrollmentDate = data.enrollment_date;
      const res = await apiClient.put(`/children/${id}`, body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update child');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.invalidateQueries({ queryKey: ['children', variables.id] });
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/children/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete child');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
}

export function useEnrollChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, classroomId }: { childId: string; classroomId: string }) => {
      const res = await apiClient.post(`/children/${childId}/enroll`, { classroomId });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to enroll child');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.invalidateQueries({ queryKey: ['children', variables.childId] });
    },
  });
}

export function useParentLinks(childId: string) {
  return useQuery({
    queryKey: ['parent-links', childId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(`/children/${childId}/parent-links`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load parent links');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!childId,
  });
}

export function useRemoveParentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, linkId }: { childId: string; linkId: string }) => {
      const res = await apiClient.delete(`/children/${childId}/parent-links/${linkId}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to remove parent link');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parent-links', variables.childId] });
    },
  });
}

function mapEmergencyContact(c: Record<string, unknown>): EmergencyContact {
  return {
    id: c.id as string,
    name: c.name as string,
    relationship: c.relationship as string,
    phone: c.phone as string,
    is_authorized_pickup: Boolean(c.isAuthorizedPickup),
  };
}

export function useEmergencyContacts(childId: string) {
  return useQuery({
    queryKey: ['emergency-contacts', childId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(`/children/${childId}/emergency-contacts`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load emergency contacts');
      return Array.isArray(res.data) ? res.data.map(mapEmergencyContact) : [];
    },
    enabled: !!childId,
  });
}

export function useAddEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, name, relationship, phone, is_authorized_pickup }: {
      childId: string; name: string; relationship: string; phone: string; is_authorized_pickup: boolean;
    }) => {
      const res = await apiClient.post(`/children/${childId}/emergency-contacts`, {
        name, relationship, phone, isAuthorizedPickup: is_authorized_pickup,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to add emergency contact');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts', variables.childId] });
    },
  });
}

export function useUpdateEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, contactId, name, relationship, phone, is_authorized_pickup }: {
      childId: string; contactId: string; name: string; relationship: string; phone: string; is_authorized_pickup: boolean;
    }) => {
      const res = await apiClient.put(`/children/${childId}/emergency-contacts/${contactId}`, {
        name, relationship, phone, isAuthorizedPickup: is_authorized_pickup,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update emergency contact');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts', variables.childId] });
    },
  });
}

export function useRemoveEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, contactId }: { childId: string; contactId: string }) => {
      const res = await apiClient.delete(`/children/${childId}/emergency-contacts/${contactId}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to remove emergency contact');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts', variables.childId] });
    },
  });
}

export function useCreateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { first_name: string; last_name: string; date_of_birth: string; gender: string; enrollment_date: string; academic_year_id: string }) => {
      const res = await apiClient.post('/children', {
        firstName: data.first_name,
        lastName: data.last_name,
        dateOfBirth: data.date_of_birth,
        gender: data.gender,
        enrollmentDate: data.enrollment_date,
        academicYearId: data.academic_year_id,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create child');
      }
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
      const res = await apiClient.post(`/children/${childId}/parent-links`, { parentUserId: parentId, relationship });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to link parent');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });
}
