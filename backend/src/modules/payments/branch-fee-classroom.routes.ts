import { Router } from 'express';
import { branchFeeClassroomController } from './branch-fee-classroom.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /api/payments/fees/:branchFeeId/classrooms — List school classrooms, flagged by link
router.get('/fees/:branchFeeId/classrooms', requireAdmin, branchFeeClassroomController.list);

// PUT /api/payments/fees/:branchFeeId/classrooms — Replace this fee's classroom links
router.put('/fees/:branchFeeId/classrooms', requireAdmin, branchFeeClassroomController.setClassrooms);

// GET /api/payments/classrooms/:classroomId/fees — Fees applicable to a classroom
router.get('/classrooms/:classroomId/fees', requireAdmin, branchFeeClassroomController.listForClassroom);

export default router;
