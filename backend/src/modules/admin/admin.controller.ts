import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { successResponse } from '../../utils/response';

export const adminController = {
  /**
   * GET /api/admin/dashboard — School-level KPI stats (admin)
   */
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const stats = await adminService.getDashboardStats(schoolId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/admin/platform-stats — Platform-level KPI stats (super_admin)
   */
  async getPlatformStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getPlatformStats();
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  },
};
