import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

export interface RolloverYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface RolloverClass {
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  childCount: number;
  teacher: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  feeIds: string[];
}

export interface RolloverFee {
  id: string;
  name: string;
  amount: string;
  billingCycle: 'monthly' | 'custom' | null;
  appliesToSchool: boolean;
}

export interface RolloverChild {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  withdrawn: boolean;
  sourceClassroomId: string | null;
  targetClassroomId: string | null;
  billedInTarget: boolean;
  feeIds: string[];
  unpaid: { id: string; name: string; amount: string }[];
}

export interface RolloverPreview {
  target: RolloverYear;
  source: RolloverYear | null;
  otherYears: RolloverYear[];
  classes: RolloverClass[];
  targetClasses: RolloverClass[];
  calendar: {
    branchId: string;
    branchName: string;
    targetCount: number;
    entries: { label: string; periodStart: string; periodEnd: string }[];
  }[];
  fees: RolloverFee[];
  children: RolloverChild[];
}

/** Where a class's children go: a copy made by the run, or a class the year already has. */
export type ClassTarget = { copyOf: string } | { classroomId: string } | null;

export interface RolloverInput {
  sourceYearId: string;
  classes: { sourceClassroomId: string; name: string }[];
  copyCalendar: boolean;
  feeAmounts: { feeId: string; amount: number }[];
  children: { childId: string; target: ClassTarget }[];
  billing: { startDate: string; extraFees: { target: ClassTarget; feeIds: string[] }[] } | null;
}

export interface RolloverResult {
  feesUpdated: number;
  calendarCopied: number;
  classesCreated: number;
  childrenPlaced: number;
  childrenBilled: number;
}

/** What preparing `targetYearId` from `fromYearId` (default: the year before) would take. */
export function useRolloverPreview(targetYearId: string, fromYearId?: string) {
  return useQuery({
    queryKey: ['year-rollover', targetYearId, fromYearId ?? null],
    queryFn: async () => {
      const res = await apiClient.get<RolloverPreview>(
        `/academic-years/${targetYearId}/rollover${fromYearId ? `?from=${fromYearId}` : ''}`,
      );
      if (!res.success) throw apiError(res.error, 'Failed to load');
      return res.data as RolloverPreview;
    },
    enabled: !!targetYearId,
  });
}

export function useRunRollover(targetYearId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RolloverInput) => {
      const res = await apiClient.post<RolloverResult>(`/academic-years/${targetYearId}/rollover`, input);
      if (!res.success) throw apiError(res.error, 'Failed to prepare the year');
      return res.data as RolloverResult;
    },
    // Classes, fees, calendar, children and billing all change.
    onSuccess: () => qc.invalidateQueries(),
  });
}
