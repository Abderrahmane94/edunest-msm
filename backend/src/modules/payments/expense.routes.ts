import { Router } from 'express';
import multer from 'multer';
import { expenseController } from './expense.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createExpenseSchema, updateExpenseSchema } from './expense.schema';
import { idParamSchema } from '../../utils/validators';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';
import prisma from '../../lib/prisma';

const router = Router();

// Multer configuration for receipt uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /expenses — Create expense (admin only)
router.post(
  '/expenses',
  requirePermission('expenses', 'edit'),
  validate(createExpenseSchema),
  rejectClosedYear(async (req) => {
    const body = req.body as { academicYearId?: string; date: string };
    return body.academicYearId ?? (await yearOf.date(req, body.date));
  }),
  expenseController.create,
);

// GET /expenses — List expenses (admin only)
router.get('/expenses', requirePermission('expenses', 'view'), expenseController.list);

// GET /expenses/deleted — Deleted expenses, with who and when (before /expenses/:id)
router.get('/expenses/deleted', requirePermission('expenses', 'view'), expenseController.listDeleted);

// GET /expenses/:id/history — What happened to an expense, who and when
router.get('/expenses/:id/history', requirePermission('expenses', 'view'), validateParams(idParamSchema), expenseController.history);

// POST /expenses/changes/:id/restore — Put a deleted expense back (not into a closed year)
router.post(
  '/expenses/changes/:id/restore',
  requirePermission('expenses', 'edit'),
  validateParams(idParamSchema),
  rejectClosedYear(async (req) => {
    const change = await prisma.expenseChange.findFirst({ where: { id: req.params.id, action: 'deleted' }, select: { snapshot: true } });
    return (change?.snapshot as { academicYearId?: string | null } | null)?.academicYearId;
  }),
  expenseController.restore,
);

// GET /expenses/changes/:id/receipt — A receipt kept in the history (replaced, or of a deleted expense)
router.get('/expenses/changes/:id/receipt', requirePermission('expenses', 'view'), validateParams(idParamSchema), expenseController.getChangeReceipt);

// GET /expenses/:id — Get expense by ID (admin only)
router.get('/expenses/:id', requirePermission('expenses', 'view'), validateParams(idParamSchema), expenseController.getById);

// PUT /expenses/:id — Update expense (admin only)
router.put(
  '/expenses/:id',
  requirePermission('expenses', 'edit'),
  validateParams(idParamSchema),
  validate(updateExpenseSchema),
  // Neither the year it is in nor the one it is moved to may be closed.
  rejectClosedYear(async (req) => {
    const body = req.body as { academicYearId?: string };
    return [await yearOf.expense(req.params.id), body.academicYearId];
  }),
  expenseController.update,
);

// DELETE /expenses/:id — Delete expense (admin only)
router.delete('/expenses/:id', requirePermission('expenses', 'edit'), validateParams(idParamSchema), rejectClosedYear((req) => yearOf.expense(req.params.id)), expenseController.remove);

// POST /expenses/:id/receipt — Upload receipt (admin only)
router.post(
  '/expenses/:id/receipt',
  requirePermission('expenses', 'edit'),
  validateParams(idParamSchema),
  rejectClosedYear((req) => yearOf.expense(req.params.id)),
  upload.single('receipt'),
  expenseController.uploadReceipt,
);

// GET /expenses/:id/receipt — Download the receipt file (admin only)
router.get(
  '/expenses/:id/receipt',
  requirePermission('expenses', 'view'),
  validateParams(idParamSchema),
  expenseController.getReceipt,
);

export default router;
