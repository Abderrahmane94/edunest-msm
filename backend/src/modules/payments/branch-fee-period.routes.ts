import { Router } from 'express';
import { branchFeePeriodController } from './branch-fee-period.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /api/payments/fees/:branchFeeId/periods — List branch periods for a year, flagged by assignment
router.get('/fees/:branchFeeId/periods', requireAdmin, branchFeePeriodController.list);

// PUT /api/payments/fees/:branchFeeId/periods — Replace this fee's period assignments for a year
router.put('/fees/:branchFeeId/periods', requireAdmin, branchFeePeriodController.setAssignments);

export default router;
