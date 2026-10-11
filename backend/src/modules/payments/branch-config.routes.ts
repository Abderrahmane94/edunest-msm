import { Router } from 'express';
import { branchConfigController } from './branch-config.controller';
import { requirePermission, requireAnyOffice } from '../../middleware/permission.middleware';

const router = Router();

// GET /branches — List branches for the user's school (admin/super_admin only)
router.get('/branches', requireAnyOffice(), branchConfigController.listBranches);

// POST /branches — Create a new branch (admin/super_admin only)
router.post('/branches', requirePermission('settings', 'edit'), branchConfigController.createBranch);

// PUT /branches/:branchId — Update a branch (admin/super_admin only)
router.put('/branches/:branchId', requirePermission('settings', 'edit'), branchConfigController.updateBranch);

// POST /branches/:branchId/config — Create billing configuration (admin/super_admin only)
router.post('/branches/:branchId/config', requirePermission('fees', 'edit'), branchConfigController.create);

// PUT /branches/:branchId/config — Update billing configuration (admin/super_admin only)
router.put('/branches/:branchId/config', requirePermission('fees', 'edit'), branchConfigController.update);

// GET /branches/:branchId/config — Get billing configuration (admin/super_admin only)
router.get('/branches/:branchId/config', requirePermission('fees', 'view'), branchConfigController.get);

export default router;
