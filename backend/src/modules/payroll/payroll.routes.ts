import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { payrollController } from './payroll.controller';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/employees', requirePermission('payroll', 'view'), payrollController.listEmployees);
router.put('/employees/:userId/salary', requirePermission('payroll', 'edit'), payrollController.setSalary);
router.get('/employees/:userId/student-days', requirePermission('payroll', 'view'), payrollController.studentDays);
router.get('/employees/:userId/substitution-days', requirePermission('payroll', 'view'), payrollController.substitutionDays);

router.get('/payments', requirePermission('payroll', 'view'), payrollController.listPayments);
router.post(
  '/payments',
  requirePermission('payroll', 'edit'),
  // The month paid sets the year (its first day).
  rejectClosedYear((req) => {
    const { year, month } = req.body as { year?: number; month?: number };
    return year && month ? yearOf.date(req, `${year}-${String(month).padStart(2, '0')}-01`) : undefined;
  }),
  payrollController.recordPayment,
);
router.delete('/payments/:id', requirePermission('payroll', 'edit'), rejectClosedYear((req) => yearOf.salaryPayment(req.params.id)), payrollController.deletePayment);

export default router;
