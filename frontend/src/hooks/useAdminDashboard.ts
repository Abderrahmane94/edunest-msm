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

interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  totalUsers: number;
  totalChildren: number;
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

export function usePlatformStats() {
  return useQuery({
    queryKey: ['admin', 'platform-stats'],
    queryFn: async () => {
      const res = await apiClient.get<PlatformStats>('/admin/platform-stats');
      return res.data ?? {
        totalSchools: 0,
        activeSchools: 0,
        inactiveSchools: 0,
        totalUsers: 0,
        totalChildren: 0,
      };
    },
  });
}
