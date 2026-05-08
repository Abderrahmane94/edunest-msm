import prisma from '../../lib/prisma';

interface DashboardStats {
  enrollmentCount: number;
  attendanceRate: number;
  outstandingInvoices: number;
  unreadMessages: number;
}

class AdminService {
  /**
   * Get dashboard KPI stats for the admin's school.
   */
  async getDashboardStats(schoolId: string): Promise<DashboardStats> {
    // 1. Enrollment count: active children in the school
    const enrollmentCount = await prisma.child.count({
      where: { schoolId, isActive: true },
    });

    // 2. Attendance rate: percentage of present+late records in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAttendance = await prisma.attendanceRecord.findMany({
      where: {
        schoolId,
        date: { gte: thirtyDaysAgo },
      },
      select: { status: true },
    });

    let attendanceRate = 0;
    if (recentAttendance.length > 0) {
      const presentOrLate = recentAttendance.filter(
        (r) => r.status === 'present' || r.status === 'late',
      ).length;
      attendanceRate = Math.round((presentOrLate / recentAttendance.length) * 100 * 100) / 100;
    }

    // 3. Outstanding invoices: sent or overdue invoices
    const outstandingInvoices = await prisma.invoice.count({
      where: {
        schoolId,
        status: { in: ['sent', 'overdue'] },
      },
    });

    // 4. Unread messages: messages in conversations for this school that are unread
    const unreadMessages = await prisma.message.count({
      where: {
        isRead: false,
        conversation: { schoolId },
      },
    });

    return {
      enrollmentCount,
      attendanceRate,
      outstandingInvoices,
      unreadMessages,
    };
  }
}

export const adminService = new AdminService();
