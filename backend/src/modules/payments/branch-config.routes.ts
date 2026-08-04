import { Router } from 'express';
import { branchConfigController } from './branch-config.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /branches — List branches for the user's school (admin/super_admin only)
router.get('/branches', requireAdmin, branchConfigController.listBranches);

// POST /branches — Create a new branch (admin/super_admin only)
router.post('/branches', requireAdmin, branchConfigController.createBranch);

// PUT /branches/:branchId — Update a branch (admin/super_admin only)
router.put('/branches/:branchId', requireAdmin, branchConfigController.updateBranch);

// POST /branches/:branchId/config — Create billing configuration (admin/super_admin only)
router.post('/branches/:branchId/config', requireAdmin, branchConfigController.create);

// PUT /branches/:branchId/config — Update billing configuration (admin/super_admin only)
router.put('/branches/:branchId/config', requireAdmin, branchConfigController.update);

// GET /branches/:branchId/config — Get billing configuration (admin/super_admin only)
router.get('/branches/:branchId/config', requireAdmin, branchConfigController.get);

export default router;
