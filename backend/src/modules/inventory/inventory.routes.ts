import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';
import { createStockItemSchema, createStockMovementSchema, updateStockItemSchema } from './inventory.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// GET /api/inventory/items — The school's supplies (teachers record what they use)
router.get('/items', requirePermission('inventory', 'view', { alsoRoles: ['teacher'] }), inventoryController.list);

// GET /api/inventory/summary — Supplies to buy again (admin only)
router.get('/summary', requirePermission('inventory', 'view'), inventoryController.summary);

// POST /api/inventory/items — Add a supply (admin only)
router.post('/items', requirePermission('inventory', 'edit'), validate(createStockItemSchema), inventoryController.create);

// PUT /api/inventory/items/:id — Update or put aside a supply (admin only)
router.put('/items/:id', requirePermission('inventory', 'edit'), validateParams(idParamSchema), validate(updateStockItemSchema), inventoryController.update);

// DELETE /api/inventory/items/:id — Delete a supply never moved (admin only)
router.delete('/items/:id', requirePermission('inventory', 'edit'), validateParams(idParamSchema), inventoryController.delete);

// GET /api/inventory/items/:id/movements — A supply's history (admin only)
router.get('/items/:id/movements', requirePermission('inventory', 'view'), validateParams(idParamSchema), inventoryController.movements);

// POST /api/inventory/items/:id/movements — Purchase or count (admin), use (admin or teacher)
router.post(
  '/items/:id/movements',
  requirePermission('inventory', 'edit', { alsoRoles: ['teacher'] }),
  validateParams(idParamSchema),
  validate(createStockMovementSchema),
  // A movement counts in its date's school year: not in a closed one.
  rejectClosedYear((req) => yearOf.date(req, (req.body as { date: string }).date)),
  inventoryController.recordMovement,
);

export default router;
