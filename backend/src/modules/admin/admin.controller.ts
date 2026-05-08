import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { successResponse } from '../../utils/response';

export const adminController = {
  /**
   * GET /api/admin/dashboard — Get dashboard KPI stats
   */
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const stats = await adminService.getDashboardStats(schoolId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  },
};
