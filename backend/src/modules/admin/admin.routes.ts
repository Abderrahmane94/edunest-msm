import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /api/admin/dashboard — Dashboard KPI stats (admin only)
router.get('/dashboard', requireAdmin, adminController.getDashboard);

export default router;
