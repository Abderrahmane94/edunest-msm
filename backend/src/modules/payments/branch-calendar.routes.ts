import { Router } from 'express';
import { branchCalendarController } from './branch-calendar.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// GET /api/payments/branches/:branchId/calendar — List calendar entries (requires academicYearId query param)
router.get('/branches/:branchId/calendar', requireAdmin, branchCalendarController.list);

// POST /api/payments/branches/:branchId/calendar — Create calendar entry
router.post('/branches/:branchId/calendar', requireAdmin, rejectClosedYear(yearOf.body()), branchCalendarController.create);

// PUT /api/payments/branches/:branchId/calendar/:id — Update calendar entry
router.put('/branches/:branchId/calendar/:id', requireAdmin, rejectClosedYear((req) => yearOf.calendar(req.params.id)), branchCalendarController.update);

// DELETE /api/payments/branches/:branchId/calendar/:id — Delete calendar entry
router.delete('/branches/:branchId/calendar/:id', requireAdmin, rejectClosedYear((req) => yearOf.calendar(req.params.id)), branchCalendarController.delete);

export default router;
