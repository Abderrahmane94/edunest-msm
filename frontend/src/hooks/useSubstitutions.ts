import { useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import { readRemembered } from '@/lib/formerName';
import { useAuth } from '@/contexts/AuthContext';

export const SUBSTITUTION_REASONS = ['illness', 'leave', 'training', 'other'] as const;
export type SubstitutionReason = (typeof SUBSTITUTION_REASONS)[number];

interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Substitution {
  id: string;
  classroomId: string;
  classroom: { id: string; name: string; academicYearId: string };
  absentTeacher: Person | null;
  /** null: nobody takes the class those days. */
  substitute: Person | null;
  substituteUserId: string | null;
  startDate: string;
  endDate: string;
  reason: SubstitutionReason;
  note: string | null;
  parentsNotified: boolean;
  cancelledAt: string | null;
  createdBy: Person;
}

export interface SubstitutionInput {
  classroomId: string;
  substituteUserId: string | null;
  newSubstitute?: { firstName: string; lastName: string; email: string; phone?: string };
  startDate: string;
  endDate: string;
  reason: SubstitutionReason;
  note?: string;
  notifyParents: boolean;
  allowBusySubstitute?: boolean;
}

export const personName = (p: Person | null | undefined) => (p ? `${p.firstName} ${p.lastName}`.trim() : '');

/** Today as YYYY-MM-DD in the viewer's time zone. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Where a replacement stands today. */
export function substitutionStatus(s: Pick<Substitution, 'startDate' | 'endDate' | 'cancelledAt'>): 'current' | 'upcoming' | 'past' | 'cancelled' {
  if (s.cancelledAt) return 'cancelled';
  const t = today();
  if (s.endDate.slice(0, 10) < t) return 'past';
  if (s.startDate.slice(0, 10) > t) return 'upcoming';
  return 'current';
}

export function useSubstitutions(filters: { classroomId?: string; userId?: string; on?: string } = {}, enabled = true) {
  const params = new URLSearchParams();
  if (filters.classroomId) params.set('classroom_id', filters.classroomId);
  if (filters.userId) params.set('user_id', filters.userId);
  if (filters.on) params.set('on', filters.on);
  return useQuery({
    queryKey: ['substitutions', filters],
    enabled,
    // Replacements change during the day.
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<Substitution[]>(`/substitutions?${params.toString()}`);
      if (!res.success) throw apiError(res.error, 'Failed to load replacements');
      return res.data as Substitution[];
    },
  });
}

function useSubstitutionMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['substitutions'] });
      // A new substitute's account shows in the teachers list.
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useCreateSubstitution() {
  return useSubstitutionMutation(async (input: SubstitutionInput) => {
    const res = await apiClient.post<{ substitution: Substitution; newSubstitute: boolean; temporaryPassword: string | null }>('/substitutions', input);
    if (!res.success) throw apiError(res.error, 'Failed to record the replacement');
    return res.data as { substitution: Substitution; newSubstitute: boolean; temporaryPassword: string | null };
  });
}

export function useUpdateSubstitution() {
  return useSubstitutionMutation(
    async ({ id, ...input }: Partial<Omit<SubstitutionInput, 'classroomId' | 'newSubstitute' | 'notifyParents'>> & { id: string }) => {
      const res = await apiClient.put<Substitution>(`/substitutions/${id}`, input);
      if (!res.success) throw apiError(res.error, 'Failed to update the replacement');
      return res.data as Substitution;
    },
  );
}

export function useEndSubstitution() {
  return useSubstitutionMutation(async (id: string) => {
    const res = await apiClient.post<Substitution>(`/substitutions/${id}/end`);
    if (!res.success) throw apiError(res.error, 'Failed to end the replacement');
    return res.data as Substitution;
  });
}

export function useCancelSubstitution() {
  return useSubstitutionMutation(async (id: string) => {
    const res = await apiClient.delete<Substitution>(`/substitutions/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to cancel the replacement');
    return res.data as Substitution;
  });
}

// ─── Teacher portal: the classes of today, and the one being worked with ───

export interface TeacherClass {
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  academicYearId: string;
  /** Set when replacing this class's teacher today. */
  substitution: { id: string; absentTeacherName: string; startDate: string; endDate: string } | null;
}

export function useMyClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-classes', user?.id],
    enabled: !!user?.id && user?.role === 'teacher',
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<TeacherClass[]>('/substitutions/my-classes');
      if (!res.success) throw apiError(res.error, 'Failed to load classes');
      return res.data as TeacherClass[];
    },
  });
}

const STORAGE_KEY = 'kiddoo.teacherClass';
const listeners = new Set<() => void>();
let chosenClassId: string | null = readRemembered(STORAGE_KEY, 'edunest.teacherClass');

export function setTeacherClassId(id: string) {
  chosenClassId = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // The choice just isn't remembered.
  }
  listeners.forEach((l) => l());
}

/** The class a teacher works with now: the one chosen, or their first one. */
export function useCurrentTeacherClass() {
  const query = useMyClasses();
  const chosen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => chosenClassId,
  );
  const classes = query.data ?? [];
  const current = classes.find((c) => c.id === chosen) ?? classes[0] ?? null;
  return { ...query, classes, current };
}
