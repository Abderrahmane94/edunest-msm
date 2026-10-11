import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { payrollController } from './payroll.controller';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/employees', payrollController.listEmployees);
router.put('/employees/:userId/salary', payrollController.setSalary);
router.get('/employees/:userId/student-days', payrollController.studentDays);
router.get('/employees/:userId/substitution-days', payrollController.substitutionDays);

router.get('/payments', payrollController.listPayments);
router.post(
  '/payments',
  // The month paid sets the year (its first day).
  rejectClosedYear((req) => {
    const { year, month } = req.body as { year?: number; month?: number };
    return year && month ? yearOf.date(req, `${year}-${String(month).padStart(2, '0')}-01`) : undefined;
  }),
  payrollController.recordPayment,
);
router.delete('/payments/:id', rejectClosedYear((req) => yearOf.salaryPayment(req.params.id)), payrollController.deletePayment);

export default router;
