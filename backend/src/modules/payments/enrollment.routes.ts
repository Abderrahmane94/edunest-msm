import { Router } from 'express';
import { enrollmentController } from './enrollment.controller';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// POST /enrollments — Create enrollment with billing period generation (admin/super_admin only)
router.post('/enrollments', requireAnyPermission([['children', 'edit'], ['fees', 'edit']]), rejectClosedYear(yearOf.body()), enrollmentController.create);

// GET /enrollments — List enrollments for a branch (admin/super_admin only)
router.get('/enrollments', requireAnyPermission([['collections', 'view'], ['fees', 'view'], ['children', 'view']]), enrollmentController.list);

// GET /enrollments/:id — Get enrollment detail with billing periods (admin/super_admin only)
router.get('/enrollments/:id', requireAnyPermission([['collections', 'view'], ['fees', 'view'], ['children', 'view']]), enrollmentController.get);

// PATCH /enrollments/:id — Update enrollment fields (admin/super_admin only)
router.patch('/enrollments/:id', requirePermission('fees', 'edit'), rejectClosedYear((req) => yearOf.enrollment(req.params.id)), enrollmentController.update);

// POST /enrollments/:id/withdraw — Withdraw enrollment (admin/super_admin only)
router.post('/enrollments/:id/withdraw', requirePermission('fees', 'edit'), rejectClosedYear((req) => yearOf.enrollment(req.params.id)), enrollmentController.withdraw);

export default router;
