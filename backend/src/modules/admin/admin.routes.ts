import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAdmin, requireSuperAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /api/admin/dashboard — School-level KPI stats (admin only)
router.get('/dashboard', requireAdmin, adminController.getDashboard);

// GET /api/admin/platform-stats — Platform-level KPI stats (super_admin only)
router.get('/platform-stats', requireSuperAdmin, adminController.getPlatformStats);

export default router;
