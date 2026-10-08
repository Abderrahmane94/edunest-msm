import prisma from '../../lib/prisma';

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
}

export const adminService = new AdminService();
