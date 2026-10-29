import { Request, Response, NextFunction } from 'express';
import { can } from '../../middleware/permission.middleware';
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
      // Money figures by right: expenses and payroll (and so the net) only to
      // whoever may see both.
      if (!((await can(req, 'expenses')) && (await can(req, 'payroll')))) {
        stats.finance = { ...stats.finance, expenses: null, salaries: null, net: null };
      }
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/admin/setup — The director's first steps, done or not
   */
  async getSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await dashboardService.getSetup(req.user!.schoolId!)));
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
