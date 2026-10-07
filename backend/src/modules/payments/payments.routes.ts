import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { requireAdmin, requireParentOrAdmin } from '../../middleware/rbac.middleware';

const router = Router();

// POST /records — Record a payment (staff only)
router.post('/records', requireAdmin, paymentsController.recordPayment);

// POST /records/correction — Record a correction (staff only)
router.post('/records/correction', requireAdmin, paymentsController.recordCorrection);

// GET /records — List payment records, branch-scoped (staff only)
router.get('/records', requireAdmin, paymentsController.list);

// GET /records/:id/receipt — Generate receipt (Staff or authorized Parent)
router.get('/records/:id/receipt', requireParentOrAdmin, paymentsController.getReceipt);

// POST /records/:id/receipt/email — Email the receipt (Staff: any address, Parent: own address)
router.post('/records/:id/receipt/email', requireParentOrAdmin, paymentsController.emailReceipt);

// GET /children/:childId/periods — List child's billing periods with derived status (staff only)
router.get('/children/:childId/periods', requireAdmin, paymentsController.getChildPeriods);

// GET /children/:childId/balance — Get child's outstanding balance (staff only)
router.get('/children/:childId/balance', requireAdmin, paymentsController.getChildBalance);

// PATCH /periods/:id/cancel — Cancel a billing period (staff only)
router.patch('/periods/:id/cancel', requireAdmin, paymentsController.cancelPeriod);

// POST /periods/:id/remind — Remind the parents of a late period (staff only)
router.post('/periods/:id/remind', requireAdmin, paymentsController.remindPeriod);

// GET /branches/:branchId/late — Late payments dashboard (staff only)
router.get('/branches/:branchId/late', requireAdmin, paymentsController.getLateDashboard);

// GET /branches/:branchId/offline-snapshot — Unpaid échéances, kept for offline recording (staff only)
router.get('/branches/:branchId/offline-snapshot', requireAdmin, paymentsController.getOfflineSnapshot);

// GET /branches/:branchId/reconciliation — Reconciliation report (admin only)
router.get('/branches/:branchId/reconciliation', requireAdmin, paymentsController.getReconciliationReport);

export default router;
