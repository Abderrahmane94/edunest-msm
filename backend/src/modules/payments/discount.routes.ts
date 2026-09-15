import { Router } from 'express';
import { discountController } from './discount.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// POST /enrollments/:enrollmentId/discounts — Create discount (admin/super_admin only)
router.post('/enrollments/:enrollmentId/discounts', requireAdmin, discountController.create);

// GET /enrollments/:enrollmentId/discounts — List discounts for an enrollment (admin/super_admin only)
router.get('/enrollments/:enrollmentId/discounts', requireAdmin, discountController.list);

// PUT /discounts/:id — Update discount (admin/super_admin only)
router.put('/discounts/:id', requireAdmin, discountController.update);

// DELETE /discounts/:id — Delete discount (admin/super_admin only)
router.delete('/discounts/:id', requireAdmin, discountController.remove);

export default router;
