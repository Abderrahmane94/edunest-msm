import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface DashboardStats {
  enrollmentCount: number;
  attendanceRate: number;
  outstandingInvoices: number;
  unreadMessages: number;
  enrollmentTrend?: { direction: 'up' | 'down'; value: string };
  attendanceTrend?: { direction: 'up' | 'down'; value: string };
  invoiceTrend?: { direction: 'up' | 'down'; value: string };
  messageTrend?: { direction: 'up' | 'down'; value: string };
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
