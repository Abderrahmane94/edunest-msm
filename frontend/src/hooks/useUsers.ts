import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  preferred_language: string;
  created_at: string;
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
  return {
    id: raw.id as string,
    email: raw.email as string,
    first_name: (raw.firstName ?? raw.first_name) as string,
    last_name: (raw.lastName ?? raw.last_name) as string,
    role: raw.role as string,
    is_active: (raw.isActive ?? raw.is_active) as boolean,
    preferred_language: (raw.preferredLanguage ?? raw.preferred_language) as string,
    created_at: (raw.createdAt ?? raw.created_at) as string,
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
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/users/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'User not found');
      return mapUser(res.data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; first_name?: string; last_name?: string; role?: string; preferred_language?: string }) => {
      const body: Record<string, unknown> = {};
      if (data.first_name !== undefined) body.firstName = data.first_name;
      if (data.last_name !== undefined) body.lastName = data.last_name;
      if (data.role !== undefined) body.role = data.role;
      if (data.preferred_language !== undefined) body.preferredLanguage = data.preferred_language;

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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; role: string; first_name: string; last_name: string }) => {
      const res = await apiClient.post('/users/invite', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
