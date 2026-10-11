import { Router } from 'express';
import { branchFeePeriodController } from './branch-fee-period.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// GET /api/payments/fees/:branchFeeId/periods — List branch periods for a year, flagged by assignment
router.get('/fees/:branchFeeId/periods', requirePermission('fees', 'view'), branchFeePeriodController.list);

// PUT /api/payments/fees/:branchFeeId/periods — Replace this fee's period assignments for a year
router.put('/fees/:branchFeeId/periods', requirePermission('fees', 'edit'), rejectClosedYear(yearOf.body()), branchFeePeriodController.setAssignments);

export default router;
