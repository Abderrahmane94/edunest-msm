import { Router } from 'express';
import { equipmentController } from './equipment.controller';
import { requirePermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createEquipmentSchema, updateEquipmentSchema } from './equipment.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// GET /api/equipment — The school's equipment, with its room (admin only)
router.get('/', requirePermission('inventory', 'view'), equipmentController.list);

// GET /api/equipment/summary — Pieces to repair (admin only)
router.get('/summary', requirePermission('inventory', 'view'), equipmentController.summary);

// POST /api/equipment — Add equipment (admin only)
router.post('/', requirePermission('inventory', 'edit'), validate(createEquipmentSchema), equipmentController.create);

// PUT /api/equipment/:id — Update equipment (admin only)
router.put('/:id', requirePermission('inventory', 'edit'), validateParams(idParamSchema), validate(updateEquipmentSchema), equipmentController.update);

// DELETE /api/equipment/:id — Remove equipment (admin only)
router.delete('/:id', requirePermission('inventory', 'edit'), validateParams(idParamSchema), equipmentController.delete);

export default router;
