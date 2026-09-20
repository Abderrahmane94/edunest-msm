import { Router } from 'express';
import { branchCalendarController } from './branch-calendar.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// GET /api/payments/branches/:branchId/calendar — List calendar entries (requires academicYearId query param)
router.get('/branches/:branchId/calendar', requireAdmin, branchCalendarController.list);

// POST /api/payments/branches/:branchId/calendar — Create calendar entry
router.post('/branches/:branchId/calendar', requireAdmin, branchCalendarController.create);

// PUT /api/payments/branches/:branchId/calendar/:id — Update calendar entry
router.put('/branches/:branchId/calendar/:id', requireAdmin, branchCalendarController.update);

// DELETE /api/payments/branches/:branchId/calendar/:id — Delete calendar entry
router.delete('/branches/:branchId/calendar/:id', requireAdmin, branchCalendarController.delete);

export default router;
