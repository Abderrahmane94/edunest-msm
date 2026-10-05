import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { registerQueueHandler, QueueRejectedError } from '@/lib/offlineQueue';

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

export type AttendanceStatus = 'present' | 'absent' | 'late';

/** A classroom's attendance for one day, as saved by PUT /api/attendance/day. */
export interface AttendanceDayPayload {
  classroomId: string;
  date: string;
  records: {
    childId: string;
    status: AttendanceStatus;
    note?: string;
    /** When the teacher marked the child (a later server change wins over it). */
    markedAt: string;
  }[];
}

export interface AttendanceDayResult {
  records: AttendanceRecord[];
  /** Children changed on the server after they were marked: left as they were. */
  skipped: string[];
}

/** What a teacher should know after attendance was sent from the queue. */
export interface AttendanceSyncNotice {
  classroomId: string;
  date: string;
  skipped: string[];
}

export const ATTENDANCE_DAY = 'attendance-day';
export const attendanceDayKey = (classroomId: string, date: string) => `attendance:${classroomId}:${date}`;

/**
 * Saves a classroom's attendance for a day (creates or updates each child;
 * safe to send again). Throws QueueRejectedError when the server refuses it,
 * a plain error when the network is down.
 */
export async function sendAttendanceDay(payload: AttendanceDayPayload): Promise<AttendanceDayResult> {
  const res = await apiClient.put<AttendanceDayResult>('/attendance/day', payload);
  if (!res.success || !res.data) {
    // An expired session isn't a refusal of the attendance: keep it until the
    // user is signed in again.
    if (res.error?.code === 'UNAUTHORIZED') throw new Error('UNAUTHORIZED');
    throw new QueueRejectedError(res.error?.message || 'Failed to save attendance');
  }
  return res.data;
}

// Attendance marked offline is queued on the device and sent when the
// connection returns.
registerQueueHandler<AttendanceDayPayload>(ATTENDANCE_DAY, {
  send: async (payload): Promise<AttendanceSyncNotice | undefined> => {
    const result = await sendAttendanceDay(payload);
    // The saved day as the server has it now (no flash of the old statuses).
    queryClient.setQueryData(['attendance', 'classroom', payload.classroomId, payload.date], result.records);
    return result.skipped.length > 0
      ? { classroomId: payload.classroomId, date: payload.date, skipped: result.skipped }
      : undefined;
  },
  // Later marks of the same child replace earlier ones.
  merge: (older, newer) => ({
    ...newer,
    records: [...new Map([...older.records, ...newer.records].map((r) => [r.childId, r])).values()],
  }),
  onSent: () => {
    void queryClient.invalidateQueries({ queryKey: ['attendance'] });
  },
});

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
