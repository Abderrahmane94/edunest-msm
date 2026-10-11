import { Router } from 'express';
import { discountController } from './discount.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// POST /enrollments/:enrollmentId/discounts — Create discount (admin/super_admin only)
router.post('/enrollments/:enrollmentId/discounts', requirePermission('fees', 'edit'), rejectClosedYear((req) => yearOf.enrollment(req.params.enrollmentId)), discountController.create);

// GET /enrollments/:enrollmentId/discounts — List discounts for an enrollment (admin/super_admin only)
router.get('/enrollments/:enrollmentId/discounts', requirePermission('fees', 'view'), discountController.list);

// PUT /discounts/:id — Update discount (admin/super_admin only)
router.put('/discounts/:id', requirePermission('fees', 'edit'), rejectClosedYear((req) => yearOf.discount(req.params.id)), discountController.update);

// DELETE /discounts/:id — Delete discount (admin/super_admin only)
router.delete('/discounts/:id', requirePermission('fees', 'edit'), rejectClosedYear((req) => yearOf.discount(req.params.id)), discountController.remove);

export default router;
