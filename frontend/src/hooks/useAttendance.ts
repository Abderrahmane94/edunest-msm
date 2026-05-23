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
  expectedWorkingDays: number;
  markedDays: number;
  unmarkedDays: number;
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
 * Mutation to update a single attendance record.
 * PATCH /api/attendance/:id
 */
export function useUpdateAttendanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, status, note }: { recordId: string; status: string; note?: string }) => {
      const res = await apiClient.patch<AttendanceRecord>(`/attendance/${recordId}`, { status, note });
      if (!res.success) throw new Error(res.error?.message || 'Failed to update attendance');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
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

// ─── Attendance Tracking (Admin) ─────────────────────────────────────────────

export interface ClassroomMarkingStatus {
  id: string;
  name: string;
  teacherName: string | null;
  marked: boolean;
  childrenCount: number;
  markedCount: number;
}

export interface DayMarkingStatus {
  date: string;
  classrooms: ClassroomMarkingStatus[];
}

/**
 * GET /api/attendance/tracking?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
export function useAttendanceTracking(startDate: string | undefined, endDate: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'tracking', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get<DayMarkingStatus[]>(
        `/attendance/tracking?start_date=${startDate}&end_date=${endDate}`
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load tracking data');
      return res.data ?? [];
    },
    enabled: !!startDate && !!endDate,
  });
}
