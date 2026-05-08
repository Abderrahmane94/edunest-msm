import { Router, raw } from 'express';
import { financeController } from './finance.controller';
import { requireAdmin, requireParentOrAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createFeeStructureSchema, updateFeeStructureSchema, createInvoiceSchema, bulkGenerateInvoicesSchema, recordCashPaymentSchema, createDiscountSchema, updateDiscountSchema, createExpenseSchema, updateExpenseSchema } from './finance.schema';
import { idParamSchema } from '../../utils/validators';
import multer from 'multer';

const router = Router();

// Multer configuration for receipt uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// ─── Webhooks (PUBLIC — no auth required) ────────────────────────────────────

// POST /api/finance/webhooks/chargily — Chargily Pay webhook
// Uses raw body parser to preserve the original payload for signature verification
router.post(
  '/webhooks/chargily',
  raw({ type: 'application/json' }),
  financeController.handleChargilyWebhook,
);

// ─── Fee Structures ──────────────────────────────────────────────────────────

// POST /api/finance/fee-structures — Create fee structure (admin only)
router.post(
  '/fee-structures',
  requireAdmin,
  validate(createFeeStructureSchema),
  financeController.createFeeStructure,
);

// GET /api/finance/fee-structures — List fee structures (admin only)
router.get(
  '/fee-structures',
  requireAdmin,
  financeController.listFeeStructures,
);

// GET /api/finance/fee-structures/:id — Get fee structure by ID (admin only)
router.get(
  '/fee-structures/:id',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.getFeeStructureById,
);

// PUT /api/finance/fee-structures/:id — Update fee structure (admin only)
router.put(
  '/fee-structures/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateFeeStructureSchema),
  financeController.updateFeeStructure,
);

// DELETE /api/finance/fee-structures/:id — Delete fee structure (admin only)
router.delete(
  '/fee-structures/:id',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.deleteFeeStructure,
);

// ─── Invoices ────────────────────────────────────────────────────────────────

// POST /api/finance/invoices — Create single invoice (admin only)
router.post(
  '/invoices',
  requireAdmin,
  validate(createInvoiceSchema),
  financeController.createInvoice,
);

// POST /api/finance/invoices/bulk — Bulk generate invoices for classroom (admin only)
router.post(
  '/invoices/bulk',
  requireAdmin,
  validate(bulkGenerateInvoicesSchema),
  financeController.bulkGenerateInvoices,
);

// GET /api/finance/invoices — List invoices (admin only)
router.get(
  '/invoices',
  requireAdmin,
  financeController.listInvoices,
);

// GET /api/finance/invoices/:id — Get invoice by ID (admin or parent)
router.get(
  '/invoices/:id',
  requireParentOrAdmin,
  validateParams(idParamSchema),
  financeController.getInvoiceById,
);

// PATCH /api/finance/invoices/:id/send — Send invoice (admin only)
router.patch(
  '/invoices/:id/send',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.sendInvoice,
);

// PATCH /api/finance/invoices/:id/cancel — Cancel invoice (admin only)
router.patch(
  '/invoices/:id/cancel',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.cancelInvoice,
);

// ─── Cash Payments ───────────────────────────────────────────────────────────

// POST /api/finance/invoices/:id/cash-payment — Record cash payment (admin only)
router.post(
  '/invoices/:id/cash-payment',
  requireAdmin,
  validateParams(idParamSchema),
  validate(recordCashPaymentSchema),
  financeController.recordCashPayment,
);

// GET /api/finance/invoices/:id/cash-payments — List cash payments on invoice (admin or parent)
router.get(
  '/invoices/:id/cash-payments',
  requireParentOrAdmin,
  validateParams(idParamSchema),
  financeController.listCashPayments,
);

// GET /api/finance/cash-payments/:id/receipt — Get cash payment receipt (admin or parent)
router.get(
  '/cash-payments/:id/receipt',
  requireParentOrAdmin,
  validateParams(idParamSchema),
  financeController.getCashPaymentReceipt,
);

// ─── Reports ─────────────────────────────────────────────────────────────────

// GET /api/finance/report/payment-methods — Payment method breakdown (admin only)
router.get(
  '/report/payment-methods',
  requireAdmin,
  financeController.getPaymentMethodBreakdown,
);

// ─── Discounts ───────────────────────────────────────────────────────────────

// POST /api/finance/discounts — Create discount (admin only)
router.post(
  '/discounts',
  requireAdmin,
  validate(createDiscountSchema),
  financeController.createDiscount,
);

// GET /api/finance/discounts — List discounts (admin only, optional childId filter)
router.get(
  '/discounts',
  requireAdmin,
  financeController.listDiscounts,
);

// GET /api/finance/discounts/:id — Get discount by ID (admin only)
router.get(
  '/discounts/:id',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.getDiscountById,
);

// PUT /api/finance/discounts/:id — Update discount (admin only)
router.put(
  '/discounts/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateDiscountSchema),
  financeController.updateDiscount,
);

// DELETE /api/finance/discounts/:id — Delete discount (admin only)
router.delete(
  '/discounts/:id',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.deleteDiscount,
);

// ─── Expenses ────────────────────────────────────────────────────────────────

// POST /api/finance/expenses — Create expense (admin only)
router.post(
  '/expenses',
  requireAdmin,
  validate(createExpenseSchema),
  financeController.createExpense,
);

// GET /api/finance/expenses — List expenses (admin only)
router.get(
  '/expenses',
  requireAdmin,
  financeController.listExpenses,
);

// GET /api/finance/expenses/:id — Get expense by ID (admin only)
router.get(
  '/expenses/:id',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.getExpenseById,
);

// PUT /api/finance/expenses/:id — Update expense (admin only)
router.put(
  '/expenses/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateExpenseSchema),
  financeController.updateExpense,
);

// DELETE /api/finance/expenses/:id — Delete expense (admin only)
router.delete(
  '/expenses/:id',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.deleteExpense,
);

// POST /api/finance/expenses/:id/receipt — Upload receipt (admin only)
router.post(
  '/expenses/:id/receipt',
  requireAdmin,
  validateParams(idParamSchema),
  upload.single('receipt'),
  financeController.uploadExpenseReceipt,
);

// GET /api/finance/expenses/:id/receipt-url — Get signed receipt URL (admin only)
router.get(
  '/expenses/:id/receipt-url',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.getExpenseReceiptUrl,
);

// ─── Audit Log ───────────────────────────────────────────────────────────────

// GET /api/finance/invoices/:id/audit-log — List audit log entries for an invoice (admin only)
router.get(
  '/invoices/:id/audit-log',
  requireAdmin,
  validateParams(idParamSchema),
  financeController.getInvoiceAuditLog,
);

// ─── Financial Reports ───────────────────────────────────────────────────────

// GET /api/finance/report/monthly — Monthly financial report (admin only)
router.get(
  '/report/monthly',
  requireAdmin,
  financeController.getMonthlyReport,
);

// GET /api/finance/report/summary — Financial summary (admin only)
router.get(
  '/report/summary',
  requireAdmin,
  financeController.getFinancialSummary,
);

export default router;
