import { Router } from 'express';
import multer from 'multer';
import { expenseController } from './expense.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createExpenseSchema, updateExpenseSchema } from './expense.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// Multer configuration for receipt uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /expenses — Create expense (admin only)
router.post('/expenses', requireAdmin, validate(createExpenseSchema), expenseController.create);

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
  expenseController.update,
);

// DELETE /expenses/:id — Delete expense (admin only)
router.delete('/expenses/:id', requireAdmin, validateParams(idParamSchema), expenseController.remove);

// POST /expenses/:id/receipt — Upload receipt (admin only)
router.post(
  '/expenses/:id/receipt',
  requireAdmin,
  validateParams(idParamSchema),
  upload.single('receipt'),
  expenseController.uploadReceipt,
);

// GET /expenses/:id/receipt-url — Get signed receipt URL (admin only)
router.get(
  '/expenses/:id/receipt-url',
  requireAdmin,
  validateParams(idParamSchema),
  expenseController.getReceiptUrl,
);

export default router;
