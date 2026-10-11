import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.middleware';

const router = Router();

// POST /records — Record a payment (staff only)
router.post('/records', requirePermission('collections', 'edit'), paymentsController.recordPayment);

// POST /records/correction — Record a correction (staff only)
router.post('/records/correction', requirePermission('collections', 'edit', { correctPayments: true }), paymentsController.recordCorrection);

// GET /records — List payment records, branch-scoped (staff only)
router.get('/records', requirePermission('collections', 'view'), paymentsController.list);

// GET /records/:id/receipt — Generate receipt (Staff or authorized Parent)
router.get('/records/:id/receipt', requirePermission('collections', 'view', { alsoRoles: ['parent'] }), paymentsController.getReceipt);

// POST /records/:id/receipt/email — Email the receipt (Staff: any address, Parent: own address)
router.post('/records/:id/receipt/email', requirePermission('collections', 'view', { alsoRoles: ['parent'] }), paymentsController.emailReceipt);

// GET /children/:childId/periods — List child's billing periods with derived status (staff only)
router.get('/children/:childId/periods', requireAnyPermission([['collections', 'view'], ['children', 'view'], ['fees', 'view']]), paymentsController.getChildPeriods);

// GET /children/:childId/balance — Get child's outstanding balance (staff only)
router.get('/children/:childId/balance', requireAnyPermission([['collections', 'view'], ['children', 'view'], ['fees', 'view']]), paymentsController.getChildBalance);

// PATCH /periods/:id/cancel — Cancel a billing period (staff only)
router.patch('/periods/:id/cancel', requirePermission('fees', 'edit'), paymentsController.cancelPeriod);

// POST /periods/:id/remind — Remind the parents of a late period (staff only)
router.post('/periods/:id/remind', requirePermission('collections', 'edit'), paymentsController.remindPeriod);

// GET /branches/:branchId/late — Late payments dashboard (staff only)
router.get('/branches/:branchId/late', requirePermission('collections', 'view'), paymentsController.getLateDashboard);

// GET /branches/:branchId/offline-snapshot — Unpaid échéances, kept for offline recording (staff only)
router.get('/branches/:branchId/offline-snapshot', requirePermission('collections', 'view'), paymentsController.getOfflineSnapshot);

// GET /branches/:branchId/reconciliation — Reconciliation report (admin only)
// A financial report (billed, collected, spent): with the expenses right.
router.get('/branches/:branchId/reconciliation', requirePermission('expenses', 'view'), paymentsController.getReconciliationReport);

export default router;
