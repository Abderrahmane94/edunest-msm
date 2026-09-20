import { Router } from 'express';
import { branchCalendarController } from './branch-calendar.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /api/payments/fees/:branchFeeId/calendar — List calendar entries (requires academicYearId query param)
router.get('/fees/:branchFeeId/calendar', requireAdmin, branchCalendarController.list);

// POST /api/payments/fees/:branchFeeId/calendar — Create calendar entry
router.post('/fees/:branchFeeId/calendar', requireAdmin, branchCalendarController.create);

// PUT /api/payments/fees/:branchFeeId/calendar/:id — Update calendar entry
router.put('/fees/:branchFeeId/calendar/:id', requireAdmin, branchCalendarController.update);

// DELETE /api/payments/fees/:branchFeeId/calendar/:id — Delete calendar entry
router.delete('/fees/:branchFeeId/calendar/:id', requireAdmin, branchCalendarController.delete);

export default router;
