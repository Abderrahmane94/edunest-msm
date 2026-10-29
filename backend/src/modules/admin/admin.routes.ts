import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireSuperAdmin } from '../../middleware/rbac.middleware';
import { requireAnyOffice } from '../../middleware/permission.middleware';

const router = Router();

// GET /api/admin/dashboard — School-level KPI stats (admin only)
router.get('/dashboard', requireAnyOffice(), adminController.getDashboard);

// GET /api/admin/setup — The director's first steps, for the guide on every page
router.get('/setup', requireAnyOffice(), adminController.getSetup);

// GET /api/admin/platform-stats — The platform admin's dashboard (super_admin only)
router.get('/platform-stats', requireSuperAdmin, adminController.getPlatformStats);

export default router;
