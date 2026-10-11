import { Router } from 'express';
import multer from 'multer';
import { expenseController } from './expense.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createExpenseSchema, updateExpenseSchema } from './expense.schema';
import { idParamSchema } from '../../utils/validators';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

const router = Router();

// Multer configuration for receipt uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /expenses — Create expense (admin only)
router.post(
  '/expenses',
  requireAdmin,
  validate(createExpenseSchema),
  rejectClosedYear(async (req) => {
    const body = req.body as { academicYearId?: string; date: string };
    return body.academicYearId ?? (await yearOf.date(req, body.date));
  }),
  expenseController.create,
);

// GET /expenses — List expenses (admin only)
router.get('/expenses', requireAdmin, expenseController.list);

// GET /expenses/:id — Get expense by ID (admin only)
router.get('/expenses/:id', requireAdmin, validateParams(idParamSchema), expenseController.getById);

// PUT /expenses/:id — Update expense (admin only)
router.put(
  '/expenses/:id',
  requireAdmin,
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
router.delete('/expenses/:id', requireAdmin, validateParams(idParamSchema), rejectClosedYear((req) => yearOf.expense(req.params.id)), expenseController.remove);

// POST /expenses/:id/receipt — Upload receipt (admin only)
router.post(
  '/expenses/:id/receipt',
  requireAdmin,
  validateParams(idParamSchema),
  rejectClosedYear((req) => yearOf.expense(req.params.id)),
  upload.single('receipt'),
  expenseController.uploadReceipt,
);

// GET /expenses/:id/receipt — Download the receipt file (admin only)
router.get(
  '/expenses/:id/receipt',
  requireAdmin,
  validateParams(idParamSchema),
  expenseController.getReceipt,
);

export default router;
