import { Router } from 'express';
import { equipmentController } from './equipment.controller';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createEquipmentSchema, updateEquipmentSchema } from './equipment.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// GET /api/equipment — The school's equipment, with its room (admin only)
router.get('/', requireAdmin, equipmentController.list);

// GET /api/equipment/summary — Pieces to repair (admin only)
router.get('/summary', requireAdmin, equipmentController.summary);

// POST /api/equipment — Add equipment (admin only)
router.post('/', requireAdmin, validate(createEquipmentSchema), equipmentController.create);

// PUT /api/equipment/:id — Update equipment (admin only)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateEquipmentSchema), equipmentController.update);

// DELETE /api/equipment/:id — Remove equipment (admin only)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), equipmentController.delete);

export default router;
