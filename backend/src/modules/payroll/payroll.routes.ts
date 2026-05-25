import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { payrollController } from './payroll.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/employees', payrollController.listEmployees);
router.put('/employees/:userId/salary', payrollController.setSalary);

router.get('/payments', payrollController.listPayments);
router.post('/payments', payrollController.recordPayment);
router.delete('/payments/:id', payrollController.deletePayment);

export default router;
