import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface DashboardStats {
  enrollmentCount: number;
  attendanceRate: number;
  outstandingInvoices: number;
  unreadMessages: number;
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
      const res = await apiClient.get<DashboardStats>('/admin/dashboard');
      return res.data ?? {
        enrollmentCount: 0,
        attendanceRate: 0,
        outstandingInvoices: 0,
        unreadMessages: 0,
      };
    },
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
