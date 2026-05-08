import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  childId: string;
  classroomId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  markedByUserId: string;
  note: string | null;
  createdAt: string;
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ChildAttendanceReportItem {
  childId: string;
  firstName: string;
  lastName: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
}

export interface ClassroomMonthlyReport {
  classroomId: string;
  month: number;
  year: number;
  totalSchoolDays: number;
  children: ChildAttendanceReportItem[];
}

/**
 * Fetch daily attendance records for a classroom on a specific date.
 * GET /api/attendance/classroom/:classroomId?date=YYYY-MM-DD
 */
export function useClassroomAttendance(classroomId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'classroom', classroomId, date],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      const res = await apiClient.get<AttendanceRecord[]>(
        `/attendance/classroom/${classroomId}?${params.toString()}`
      );
      return res.data ?? [];
    },
    enabled: !!classroomId && !!date,
  });
}

/**
 * Fetch monthly attendance report for a classroom.
 * GET /api/attendance/report/classroom/:classroomId?month=MM&year=YYYY
 */
export function useClassroomMonthlyReport(
  classroomId: string | undefined,
  month: number | undefined,
  year: number | undefined
) {
  return useQuery({
    queryKey: ['attendance', 'report', classroomId, month, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month != null) params.set('month', String(month));
      if (year != null) params.set('year', String(year));
      const res = await apiClient.get<ClassroomMonthlyReport>(
        `/attendance/report/classroom/${classroomId}?${params.toString()}`
      );
      return res.data ?? null;
    },
    enabled: !!classroomId && month != null && year != null,
  });
}

export interface BulkAttendanceRecord {
  child_id: string;
  status: 'present' | 'absent' | 'late';
  note?: string;
}

export interface BulkAttendancePayload {
  classroom_id: string;
  date: string;
  records: BulkAttendanceRecord[];
}

/**
 * Mutation to bulk mark attendance for a classroom.
 * POST /api/attendance/bulk-mark
 */
export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkAttendancePayload) => {
      // Backend expects camelCase field names
      const body = {
        classroomId: payload.classroom_id,
        date: payload.date,
        records: payload.records.map((r) => ({
          childId: r.child_id,
          status: r.status,
          note: r.note,
        })),
      };
      const res = await apiClient.post<AttendanceRecord[]>('/attendance/bulk-mark', body);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to mark attendance');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attendance', 'classroom', variables.classroom_id, variables.date],
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'report'] });
    },
  });
}
