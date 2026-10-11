import { Router } from 'express';
import { branchFeeClassroomController } from './branch-fee-classroom.controller';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.middleware';

const router = Router();

// GET /api/payments/fees/:branchFeeId/classrooms — List school classrooms, flagged by link
router.get('/fees/:branchFeeId/classrooms', requirePermission('fees', 'view'), branchFeeClassroomController.list);

// PUT /api/payments/fees/:branchFeeId/classrooms — Replace this fee's classroom links
router.put('/fees/:branchFeeId/classrooms', requirePermission('fees', 'edit'), branchFeeClassroomController.setClassrooms);

// PUT /api/payments/fees/:branchFeeId/scope — Change who the fee is for (dryRun to preview)
router.put('/fees/:branchFeeId/scope', requirePermission('fees', 'edit'), branchFeeClassroomController.changeScope);

// GET /api/payments/classrooms/:classroomId/fees — Fees applicable to a classroom
router.get('/classrooms/:classroomId/fees', requireAnyPermission([['fees', 'view'], ['children', 'view'], ['classes', 'view'], ['collections', 'view']]), branchFeeClassroomController.listForClassroom);

export default router;
