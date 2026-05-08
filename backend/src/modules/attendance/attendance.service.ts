import prisma from '../../lib/prisma';
import { notificationService } from '../../services/notification.service';
import type { BulkMarkAttendanceInput, UpdateAttendanceInput } from './attendance.schema';
import type {
  AttendanceRecordWithChild,
  AttendanceRecordWithDetails,
  ClassroomMonthlyReport,
  ChildMonthlySummary,
} from './attendance.types';

export class AttendanceServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AttendanceServiceError';
  }
}

const childSelect = {
  id: true,
  firstName: true,
  lastName: true,
};

const markedBySelect = {
  id: true,
  firstName: true,
  lastName: true,
};

class AttendanceService {
  /**
   * Bulk mark attendance for a classroom on a given date.
   * Creates one AttendanceRecord per child in a transaction.
   * Enforces:
   * - Classroom belongs to the school
   * - Teacher is assigned to the classroom (or user is admin)
   * - Unique constraint on child_id + date (returns 409 if duplicate)
   */
  async bulkMark(
    schoolId: string,
    userId: string,
    userRole: string,
    input: BulkMarkAttendanceInput,
  ): Promise<AttendanceRecordWithChild[]> {
    const { classroomId, date, records } = input;

    // Validate classroom belongs to the school
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
    });

    if (!classroom) {
      throw new AttendanceServiceError('Classroom not found or does not belong to this school', 404);
    }

    // If user is a teacher, verify they are assigned to this classroom
    if (userRole === 'teacher') {
      if (classroom.teacherUserId !== userId) {
        throw new AttendanceServiceError(
          'You are not assigned to this classroom. Only the assigned teacher or an admin can mark attendance.',
          403,
        );
      }
    }

    // Check for existing records for any of the children on this date
    const childIds = records.map((r) => r.childId);
    const existingRecords = await prisma.attendanceRecord.findMany({
      where: {
        childId: { in: childIds },
        date: new Date(date),
      },
      select: { childId: true },
    });

    if (existingRecords.length > 0) {
      const duplicateIds = existingRecords.map((r) => r.childId);
      throw new AttendanceServiceError(
        `Attendance already marked for the following children on ${date}: ${duplicateIds.join(', ')}`,
        409,
      );
    }

    // Create all records in a transaction
    const attendanceRecords = await prisma.$transaction(
      records.map((record) =>
        prisma.attendanceRecord.create({
          data: {
            schoolId,
            childId: record.childId,
            classroomId,
            date: new Date(date),
            status: record.status,
            markedByUserId: userId,
            note: record.note || null,
          },
          include: {
            child: { select: childSelect },
          },
        }),
      ),
    );

    // Dispatch absence notifications for children marked absent
    const absentRecords = attendanceRecords.filter((r) => r.status === 'absent');
    if (absentRecords.length > 0) {
      // Fire and forget — don't block the response on notification delivery
      Promise.allSettled(
        absentRecords.map((record) =>
          notificationService.dispatchAbsenceNotifications(record.childId, record.id, date),
        ),
      ).catch((err) => {
        console.error('[AttendanceService] Error dispatching absence notifications:', err);
      });
    }

    return attendanceRecords;
  }

  /**
   * Update a single attendance record (e.g., marking late after initial roll call).
   * Enforces:
   * - Record belongs to the school
   * - Teacher is assigned to the classroom (or user is admin)
   */
  async update(
    id: string,
    schoolId: string,
    userId: string,
    userRole: string,
    input: UpdateAttendanceInput,
  ): Promise<AttendanceRecordWithDetails> {
    const record = await prisma.attendanceRecord.findFirst({
      where: { id, schoolId },
      include: { classroom: true },
    });

    if (!record) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    // If user is a teacher, verify they are assigned to the classroom
    if (userRole === 'teacher') {
      if (record.classroom.teacherUserId !== userId) {
        throw new AttendanceServiceError(
          'You are not assigned to this classroom. Only the assigned teacher or an admin can update attendance.',
          403,
        );
      }
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.note !== undefined && { note: input.note || null }),
      },
      include: {
        child: { select: childSelect },
        markedBy: { select: markedBySelect },
      },
    });

    return updated;
  }

  /**
   * Get attendance records for a classroom on a specific date.
   * Enforces teacher assignment or admin access.
   */
  async getByClassroom(
    classroomId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    date: string,
  ): Promise<AttendanceRecordWithChild[]> {
    // Validate classroom belongs to the school
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
    });

    if (!classroom) {
      throw new AttendanceServiceError('Classroom not found or does not belong to this school', 404);
    }

    // If user is a teacher, verify they are assigned to this classroom
    if (userRole === 'teacher') {
      if (classroom.teacherUserId !== userId) {
        throw new AttendanceServiceError(
          'You are not assigned to this classroom.',
          403,
        );
      }
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        classroomId,
        schoolId,
        date: new Date(date),
      },
      include: {
        child: { select: childSelect },
      },
      orderBy: { child: { lastName: 'asc' } },
    });

    return records;
  }

  /**
   * Get attendance history for a specific child.
   * Parents can only access their own linked children.
   * Teachers can access children in their classroom.
   * Admins can access any child in their school.
   */
  async getByChild(
    childId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    options: { startDate?: string; endDate?: string; page: number; pageSize: number },
  ): Promise<{ records: AttendanceRecordWithDetails[]; total: number }> {
    // Validate child belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new AttendanceServiceError('Child not found or does not belong to this school', 404);
    }

    // If user is a parent, verify they are linked to this child
    if (userRole === 'parent') {
      const link = await prisma.parentChildLink.findFirst({
        where: { childId, parentUserId: userId },
      });
      if (!link) {
        throw new AttendanceServiceError('You do not have access to this child\'s attendance records', 403);
      }
    }

    // If user is a teacher, verify the child is in their classroom
    if (userRole === 'teacher') {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });
      if (!enrollment) {
        throw new AttendanceServiceError(
          'This child is not in your assigned classroom.',
          403,
        );
      }
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (options.startDate) {
      dateFilter.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      dateFilter.lte = new Date(options.endDate);
    }

    const where = {
      childId,
      schoolId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    };

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        orderBy: { date: 'desc' },
        include: {
          child: { select: childSelect },
          markedBy: { select: markedBySelect },
        },
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    return { records, total };
  }

  /**
   * Get monthly attendance report for a classroom.
   * Returns total school days, present/absent/late counts, and attendance percentage per child.
   * totalSchoolDays = count of distinct dates with at least one attendance record for the classroom in that month.
   * Attendance percentage = (present + late) / totalSchoolDays * 100, rounded to 2 decimal places.
   * Admin-only access.
   */
  async getClassroomMonthlyReport(
    classroomId: string,
    schoolId: string,
    month: number,
    year: number,
  ): Promise<ClassroomMonthlyReport> {
    // Validate classroom belongs to the school
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
    });

    if (!classroom) {
      throw new AttendanceServiceError('Classroom not found or does not belong to this school', 404);
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month

    // Get all attendance records for this classroom in the month
    const records = await prisma.attendanceRecord.findMany({
      where: {
        classroomId,
        schoolId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        child: { select: childSelect },
      },
    });

    // Calculate total school days: distinct dates with at least one record
    const distinctDates = new Set(records.map((r) => r.date.toISOString()));
    const totalSchoolDays = distinctDates.size;

    // Group records by child
    const childMap = new Map<string, {
      firstName: string;
      lastName: string;
      presentCount: number;
      absentCount: number;
      lateCount: number;
    }>();

    for (const record of records) {
      const existing = childMap.get(record.childId);
      if (!existing) {
        childMap.set(record.childId, {
          firstName: record.child.firstName,
          lastName: record.child.lastName,
          presentCount: record.status === 'present' ? 1 : 0,
          absentCount: record.status === 'absent' ? 1 : 0,
          lateCount: record.status === 'late' ? 1 : 0,
        });
      } else {
        if (record.status === 'present') existing.presentCount++;
        else if (record.status === 'absent') existing.absentCount++;
        else if (record.status === 'late') existing.lateCount++;
      }
    }

    // Build children array with attendance percentage
    const children = Array.from(childMap.entries()).map(([childId, data]) => ({
      childId,
      firstName: data.firstName,
      lastName: data.lastName,
      presentCount: data.presentCount,
      absentCount: data.absentCount,
      lateCount: data.lateCount,
      attendancePercentage:
        totalSchoolDays > 0
          ? Math.round(((data.presentCount + data.lateCount) / totalSchoolDays) * 100 * 100) / 100
          : 0,
    }));

    return {
      classroomId,
      month,
      year,
      totalSchoolDays,
      children,
    };
  }

  /**
   * Get monthly attendance summary for a specific child.
   * Returns total school days, present/absent/late counts, and attendance percentage.
   * totalSchoolDays = count of distinct dates with at least one attendance record for the child's classroom in that month.
   * Attendance percentage = (present + late) / totalSchoolDays * 100, rounded to 2 decimal places.
   * Accessible by admin, teacher (if child is in their classroom), and parent (if linked).
   */
  async getChildMonthlySummary(
    childId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    month: number,
    year: number,
  ): Promise<ChildMonthlySummary> {
    // Validate child belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new AttendanceServiceError('Child not found or does not belong to this school', 404);
    }

    // If user is a parent, verify they are linked to this child
    if (userRole === 'parent') {
      const link = await prisma.parentChildLink.findFirst({
        where: { childId, parentUserId: userId },
      });
      if (!link) {
        throw new AttendanceServiceError('You do not have access to this child\'s attendance records', 403);
      }
    }

    // If user is a teacher, verify the child is in their classroom
    if (userRole === 'teacher') {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });
      if (!enrollment) {
        throw new AttendanceServiceError(
          'This child is not in your assigned classroom.',
          403,
        );
      }
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month

    // Get the child's current classroom enrollment to determine totalSchoolDays
    const enrollment = await prisma.classroomEnrollment.findFirst({
      where: { childId },
      select: { classroomId: true },
    });

    let totalSchoolDays = 0;

    if (enrollment) {
      // Count distinct dates with at least one attendance record for the classroom in that month
      const classroomRecords = await prisma.attendanceRecord.findMany({
        where: {
          classroomId: enrollment.classroomId,
          schoolId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { date: true },
      });
      const distinctDates = new Set(classroomRecords.map((r) => r.date.toISOString()));
      totalSchoolDays = distinctDates.size;
    }

    // Get the child's attendance records for the month
    const childRecords = await prisma.attendanceRecord.findMany({
      where: {
        childId,
        schoolId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    for (const record of childRecords) {
      if (record.status === 'present') presentCount++;
      else if (record.status === 'absent') absentCount++;
      else if (record.status === 'late') lateCount++;
    }

    const attendancePercentage =
      totalSchoolDays > 0
        ? Math.round(((presentCount + lateCount) / totalSchoolDays) * 100 * 100) / 100
        : 0;

    return {
      childId,
      firstName: child.firstName,
      lastName: child.lastName,
      month,
      year,
      totalSchoolDays,
      presentCount,
      absentCount,
      lateCount,
      attendancePercentage,
    };
  }

  /**
   * Get monthly attendance summary for all children linked to a parent.
   * Returns attendance stats per child for the given month (YYYY-MM format).
   */
  async getParentChildrenAttendance(
    parentUserId: string,
    schoolId: string,
    month: string,
  ): Promise<{ month: string; children: Array<{
    child_id: string;
    child_name: string;
    child_photo_url?: string;
    present_count: number;
    absent_count: number;
    late_count: number;
    total_days: number;
    attendance_percentage: number;
  }> }> {
    // Parse month string (YYYY-MM)
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of the month

    // Get all children linked to this parent
    const links = await prisma.parentChildLink.findMany({
      where: { parentUserId },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoPublicId: true,
            schoolId: true,
            enrollments: {
              select: { classroomId: true },
              take: 1,
            },
          },
        },
      },
    });

    // Filter to children in the same school
    const childrenInSchool = links
      .filter((link) => link.child.schoolId === schoolId)
      .map((link) => link.child);

    const children = await Promise.all(
      childrenInSchool.map(async (child) => {
        // Determine total school days from the child's classroom
        let totalDays = 0;
        if (child.enrollments.length > 0) {
          const classroomRecords = await prisma.attendanceRecord.findMany({
            where: {
              classroomId: child.enrollments[0].classroomId,
              schoolId,
              date: { gte: startDate, lte: endDate },
            },
            select: { date: true },
          });
          const distinctDates = new Set(classroomRecords.map((r) => r.date.toISOString()));
          totalDays = distinctDates.size;
        }

        // Get the child's attendance records for the month
        const records = await prisma.attendanceRecord.findMany({
          where: {
            childId: child.id,
            schoolId,
            date: { gte: startDate, lte: endDate },
          },
        });

        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;

        for (const record of records) {
          if (record.status === 'present') presentCount++;
          else if (record.status === 'absent') absentCount++;
          else if (record.status === 'late') lateCount++;
        }

        const attendancePercentage =
          totalDays > 0
            ? Math.round(((presentCount + lateCount) / totalDays) * 100 * 100) / 100
            : 0;

        return {
          child_id: child.id,
          child_name: `${child.firstName} ${child.lastName}`,
          ...(child.photoPublicId && { child_photo_url: child.photoPublicId }),
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          total_days: totalDays,
          attendance_percentage: attendancePercentage,
        };
      }),
    );

    return { month, children };
  }
}


export const attendanceService = new AttendanceService();
