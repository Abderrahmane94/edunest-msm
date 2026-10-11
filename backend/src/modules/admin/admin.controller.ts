import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { platformDashboardService } from './platform-dashboard.service';
import { successResponse } from '../../utils/response';

export const adminController = {
  /**
   * GET /api/admin/dashboard — The school director's dashboard (admin)
   */
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const stats = await dashboardService.getAdminDashboard(schoolId);
      // The administrative staff see collections, not expenses and payroll.
      if (req.user!.role === 'administrative') {
        stats.finance = { ...stats.finance, expenses: null, salaries: null, net: null };
      }
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/admin/platform-stats — The platform admin's dashboard (super_admin)
   */
  async getPlatformStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await platformDashboardService.getPlatformDashboard();
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  },
};
