import prisma from '../../lib/prisma';

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

class AdminService {
  /**
   * Get platform-level KPI stats for super_admin.
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const [totalSchools, activeSchools, totalUsers, totalChildren] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { not: 'super_admin' } } }),
      prisma.child.count({ where: { isActive: true } }),
    ]);

    return {
      totalSchools,
      activeSchools,
      inactiveSchools: totalSchools - activeSchools,
      totalUsers,
      totalChildren,
    };
  }

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

    // 4. Unread messages: conversations where parent is waiting 3+ hours for teacher reply
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const conversations = await prisma.conversation.findMany({
      where: { schoolId },
      select: {
        parentUserId: true,
        teacherUserId: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { senderUserId: true, createdAt: true },
        },
      },
    });

    let unreadMessages = 0;
    for (const conv of conversations) {
      if (conv.messages.length === 0) continue;
      const lastParentMsg = conv.messages.find((m) => m.senderUserId === conv.parentUserId);
      if (!lastParentMsg) continue;
      const lastTeacherMsg = conv.messages.find((m) => m.senderUserId === conv.teacherUserId);
      if (lastTeacherMsg && lastTeacherMsg.createdAt > lastParentMsg.createdAt) continue;
      if (lastParentMsg.createdAt <= threeHoursAgo) {
        unreadMessages++;
      }
    }

    return {
      enrollmentCount,
      attendanceRate,
      outstandingInvoices,
      unreadMessages,
    };
  }
}

export const adminService = new AdminService();
