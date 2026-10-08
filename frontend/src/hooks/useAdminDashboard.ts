import { useQuery } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

/** The school director's dashboard (GET /admin/dashboard); amounts in DZD. */
export interface AdminDashboard {
  /** The school's date today, YYYY-MM-DD. */
  today: string;
  schoolName: string;
  attendance: {
    isSchoolDay: boolean;
    expected: number;
    present: number;
    late: number;
    absent: number;
    missingClassrooms: { id: string; name: string; teacherName: string | null; childCount: number }[];
    classroomsToday: number;
    weeks: { weekStart: string; rate: number | null }[];
  };
  dailyReports: { sent: number; expected: number };
  finance: {
    /** YYYY-MM */
    month: string;
    collected: number;
    collectedPreviousMonth: number;
    expenses: number;
    salaries: number;
    net: number;
    late: { amount: number; children: number };
    recoveryRate: number | null;
    monthly: { month: string; collected: number }[];
  };
  enrollment: {
    activeChildren: number;
    newThisMonth: number;
    classrooms: { id: string; name: string; capacity: number; enrolled: number }[];
  };
  communication: {
    waitingParents: number;
    pendingConsents: number;
    upcomingEvents: { id: string; title: string; startDatetime: string; location: string | null }[];
  };
}

export type SchoolState = 'none' | 'trial' | 'active' | 'overdue' | 'cancelled' | 'suspended' | 'disabled';
export type SchoolAlert = 'overdue' | 'renewalDue' | 'trialEnding' | 'noSubscription' | 'overLimit' | 'dormant';
type PerRole = { admin: number; teacher: number; parent: number };

export interface PlatformSchoolRow {
  id: string;
  name: string;
  wilaya: string;
  isActive: boolean;
  state: SchoolState;
  planName: string | null;
  monthlyPrice: number | null;
  periodPrice: number | null;
  /** End of the paid period, or of the trial (YYYY-MM-DD). */
  periodEnd: string | null;
  children: number;
  maxChildren: number | null;
  users: number;
  maxUsers: number | null;
  lastActiveAt: string | null;
  createdAt: string;
  /** Most urgent first. */
  alerts: SchoolAlert[];
}

/** The platform admin's dashboard (GET /admin/platform-stats); amounts in DZD. */
export interface PlatformDashboard {
  today: string;
  revenue: {
    mrr: number;
    collectedThisMonth: number;
    collectedPreviousMonth: number;
    overdueAmount: number;
    overdueCount: number;
    monthly: { month: string; collected: number }[];
  };
  schools: {
    total: number;
    byState: Record<SchoolState, number>;
    newThisMonth: number;
    growth: { month: string; created: number }[];
  };
  usage: {
    activeUsers: PerRole;
    totalUsers: PerRole;
    totalChildren: number;
    lastWeek: { attendance: number; dailyReports: number; messages: number; payments: number };
  };
  /** Schools needing attention first. */
  schoolRows: PlatformSchoolRow[];
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<AdminDashboard>('/admin/dashboard');
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load the dashboard');
      return res.data;
    },
    // Today's figures move during the day (roll call, payments).
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePlatformDashboard() {
  return useQuery({
    queryKey: ['admin', 'platform-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<PlatformDashboard>('/admin/platform-stats');
      if (!res.success || !res.data) throw apiError(res.error, 'Failed to load the dashboard');
      return res.data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
