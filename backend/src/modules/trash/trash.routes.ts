import { Router } from 'express';
import { trashController } from './trash.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { validateParams } from '../../middleware/validation.middleware';
import { trashListSchema, trashActionSchema } from './trash.schema';

const router = Router();

// GET /api/trash/:entityType — List deleted records (admin only)
router.get('/:entityType', requirePermission('settings', 'view'), validateParams(trashListSchema), trashController.list);

// POST /api/trash/:entityType/:id/restore — Restore a deleted record (admin only)
router.post('/:entityType/:id/restore', requirePermission('settings', 'edit'), validateParams(trashActionSchema), trashController.restore);

// DELETE /api/trash/:entityType/:id — Permanently delete a record (admin only)
router.delete('/:entityType/:id', requirePermission('settings', 'edit', { delete: true }), validateParams(trashActionSchema), trashController.hardDelete);

export default router;
