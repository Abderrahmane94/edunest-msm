import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import type { CreatedAccount } from '@/lib/newAccount';

// ─── The platform's view: associations, their clubs and officers ───

export interface AssociationOfficer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  lastActiveAt: string | null;
}

export interface AssociationRow {
  id: string;
  name: string;
  createdAt: string;
  clubs: { id: string; name: string; wilaya: string }[];
  officers: AssociationOfficer[];
}

export interface OfficerInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  preferredLanguage: 'fr' | 'ar';
}

export function useAssociations() {
  return useQuery({
    queryKey: ['associations'],
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<AssociationRow[]>('/associations');
      if (!res.success) throw apiError(res.error, 'Failed to load the associations');
      return res.data ?? [];
    },
  });
}

/** A change to the associations: the list is read again after it. */
export function useAssociationAction<TInput, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['associations'] });
      // A club's own page says which association sees its figures.
      void qc.invalidateQueries({ queryKey: ['schools'] });
    },
  });
}

type Answer<T> = { success: boolean; data?: T; error?: Parameters<typeof apiError>[0] };

async function send<T = unknown>(request: Promise<Answer<T>>, fallback: string): Promise<T> {
  const res = await request;
  if (!res.success) throw apiError(res.error, fallback);
  return res.data as T;
}

export const associationApi = {
  create: (name: string) => send(apiClient.post('/associations', { name }), 'Failed to create the association'),
  rename: ({ id, name }: { id: string; name: string }) => send(apiClient.patch(`/associations/${id}`, { name }), 'Failed to rename'),
  remove: (id: string) => send(apiClient.delete(`/associations/${id}`), 'Failed to remove the association'),
  addClub: ({ id, schoolId }: { id: string; schoolId: string }) =>
    send(apiClient.put(`/associations/${id}/clubs/${schoolId}`, {}), 'Failed to add the club'),
  removeClub: ({ id, schoolId }: { id: string; schoolId: string }) =>
    send(apiClient.delete(`/associations/${id}/clubs/${schoolId}`), 'Failed to remove the club'),
  addOfficer: ({ id, input }: { id: string; input: OfficerInput }) =>
    send(apiClient.post<CreatedAccount>(`/associations/${id}/officers`, input), 'Failed to create the account'),
  removeOfficer: ({ id, userId }: { id: string; userId: string }) =>
    send(apiClient.delete(`/associations/${id}/officers/${userId}`), 'Failed to remove the account'),
};

// ─── The officer's view: the clubs' figures ───

export interface ClubFigures {
  id: string;
  name: string;
  wilaya: string;
  isOpen: boolean;
  children: { active: number; newInMonth: number };
  staff: { teachers: number; office: number; other: number; total: number };
  classrooms: { count: number; capacity: number; enrolled: number };
  attendance: {
    today: { isSchoolDay: boolean; expected: number; present: number; late: number; absent: number };
    month: { rate: number | null; marks: number; attended: number };
  };
  finance: {
    collected: number;
    expenses: number;
    salaries: number;
    net: number;
    late: { amount: number; children: number };
    recoveryRate?: number | null;
  };
}

export interface AssociationOverview {
  association: { id: string; name: string };
  month: string;
  today: string;
  totals: Omit<ClubFigures, 'id' | 'name' | 'wilaya' | 'isOpen'> & { clubs: number };
  clubs: ClubFigures[];
}

export function useAssociationOverview(month: string) {
  return useQuery({
    queryKey: ['association-overview', month],
    queryFn: async () => {
      const res = await apiClient.get<AssociationOverview>(`/associations/me/overview?month=${month}`);
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load the figures');
      return res.data;
    },
  });
}

/** The officer's association, for the menu's header. */
export function useMyAssociation(enabled = true) {
  return useQuery({
    queryKey: ['my-association'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await apiClient.get<{ association: { id: string; name: string } }>('/associations/me');
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load the association');
      return res.data.association;
    },
  });
}
