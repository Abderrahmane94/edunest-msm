import { Router } from 'express';
import { enrollmentController } from './enrollment.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// POST /enrollments — Create enrollment with billing period generation (admin/super_admin only)
router.post('/enrollments', requireAdmin, rejectClosedYear(yearOf.body()), enrollmentController.create);

// GET /enrollments — List enrollments for a branch (admin/super_admin only)
router.get('/enrollments', requireAdmin, enrollmentController.list);

// GET /enrollments/:id — Get enrollment detail with billing periods (admin/super_admin only)
router.get('/enrollments/:id', requireAdmin, enrollmentController.get);

// PATCH /enrollments/:id — Update enrollment fields (admin/super_admin only)
router.patch('/enrollments/:id', requireAdmin, rejectClosedYear((req) => yearOf.enrollment(req.params.id)), enrollmentController.update);

// POST /enrollments/:id/withdraw — Withdraw enrollment (admin/super_admin only)
router.post('/enrollments/:id/withdraw', requireAdmin, rejectClosedYear((req) => yearOf.enrollment(req.params.id)), enrollmentController.withdraw);

export default router;
