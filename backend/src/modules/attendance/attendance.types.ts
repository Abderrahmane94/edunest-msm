import { AttendanceStatus } from '@prisma/client';

export interface AttendanceRecordResponse {
  id: string;
  schoolId: string;
  childId: string;
  classroomId: string;
  date: Date;
  status: AttendanceStatus;
  markedByUserId: string;
  note: string | null;
  createdAt: Date;
}

export interface AttendanceRecordWithChild extends AttendanceRecordResponse {
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface AttendanceRecordWithDetails extends AttendanceRecordResponse {
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
  markedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface BulkMarkInput {
  classroomId: string;
  date: string;
  records: {
    childId: string;
    status: AttendanceStatus;
    note?: string;
  }[];
}

export interface UpdateAttendanceInput {
  status: AttendanceStatus;
  note?: string;
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

export interface ChildMonthlySummary {
  childId: string;
  firstName: string;
  lastName: string;
  month: number;
  year: number;
  totalSchoolDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
}
