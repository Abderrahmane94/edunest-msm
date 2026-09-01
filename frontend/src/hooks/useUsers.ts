import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '@/lib/api-client';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  preferred_language: string;
  created_at: string;
  school_id?: string;
  school_name?: string;
  phone?: string | null;
  address?: string | null;
  national_id?: string | null;
}

interface UsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}

interface UsersResult {
  users: User[];
  total: number;
}

// The API returns camelCase fields; map them to the interface the UI expects
function mapUser(raw: Record<string, unknown>): User {
  const school = raw.school as Record<string, unknown> | undefined;
  return {
    id: raw.id as string,
    email: raw.email as string,
    first_name: (raw.firstName ?? raw.first_name) as string,
    last_name: (raw.lastName ?? raw.last_name) as string,
    role: raw.role as string,
    is_active: (raw.isActive ?? raw.is_active) as boolean,
    preferred_language: (raw.preferredLanguage ?? raw.preferred_language) as string,
    created_at: (raw.createdAt ?? raw.created_at) as string,
    school_id: (raw.schoolId ?? raw.school_id) as string | undefined,
    school_name: school ? (school.name as string) : undefined,
    phone: (raw.phone ?? null) as string | null,
    address: (raw.address ?? null) as string | null,
    national_id: (raw.nationalId ?? raw.national_id ?? null) as string | null,
  };
}

export function useUsers(params: UsersParams = {}) {
  const { page = 1, pageSize = 10, search, sortColumn, sortDirection } = params;
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (search) queryParams.set('search', search);
  if (sortColumn) queryParams.set('sortBy', sortColumn);
  if (sortDirection) queryParams.set('sortDir', sortDirection);

  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(`/users?${queryParams.toString()}`);

      // Handle both response shapes:
      // Shape 1: { users: [...], total } (wrapped)
      // Shape 2: [...] (array directly in data) with meta.pagination.total
      const raw = res.data as Record<string, unknown> | unknown[];
      let users: User[] = [];
      let total = 0;

      if (Array.isArray(raw)) {
        users = raw.map((u) => mapUser(u as Record<string, unknown>));
        total = (res.meta as { pagination?: { total?: number } })?.pagination?.total ?? users.length;
      } else if (raw && typeof raw === 'object' && 'users' in raw) {
        const wrapped = raw as { users: Record<string, unknown>[]; total: number };
        users = wrapped.users.map(mapUser);
        total = wrapped.total;
      }

      return { users, total } as UsersResult;
    },
    placeholderData: (prev) => prev,
  });
}

export interface UserWithSchool extends User {
  school?: { id: string; name: string; schoolType: string } | null;
  deletedAt?: string | null;
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/users/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'User not found');
      const raw = res.data as Record<string, unknown>;
      const base = mapUser(raw);
      const school = raw.school as { id: string; name: string; schoolType: string } | null | undefined;
      const deletedAt = (raw.deletedAt ?? raw.deleted_at ?? null) as string | null;
      return { ...base, school: school ?? null, deletedAt } as UserWithSchool;
    },
    enabled: !!id,
    staleTime: 0, // always fetch fresh — school info may not be in older cache entries
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; first_name?: string; last_name?: string; role?: string; preferred_language?: string; phone?: string; address?: string; national_id?: string }) => {
      const body: Record<string, unknown> = {};
      if (data.first_name !== undefined) body.firstName = data.first_name;
      if (data.last_name !== undefined) body.lastName = data.last_name;
      if (data.role !== undefined) body.role = data.role;
      if (data.preferred_language !== undefined) body.preferredLanguage = data.preferred_language;
      if (data.phone?.trim()) body.phone = data.phone.trim();
      if (data.address?.trim()) body.address = data.address.trim();
      if (data.national_id?.trim()) body.nationalId = data.national_id.trim();

      const res = await apiClient.patch(`/users/${id}`, body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update user');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', variables.id] });
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = isActive ? `/users/${id}/deactivate` : `/users/${id}/activate`;
      const res = await apiClient.patch(endpoint);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to update user status');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useInviteUser() {
  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiClient.post<{ message: string }>('/users/invite', data);
      if (!res.success) {
        throw new ApiRequestError(res.error ?? { code: 'UNKNOWN_ERROR', message: 'Failed to send invitation' });
      }
      return res.data;
    },
  });
}
