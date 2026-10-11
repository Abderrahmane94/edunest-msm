import { Router } from 'express';
import { roomsController } from './rooms.controller';
import { requirePermission, requireAnyOffice } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createRoomSchema, updateRoomSchema } from './rooms.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// GET /api/rooms — List the school's rooms with their classes (admin or teacher)
router.get('/', requireAnyOffice({ alsoRoles: ['teacher'] }), roomsController.list);

// POST /api/rooms — Add a room (admin only)
router.post('/', requirePermission('settings', 'edit'), validate(createRoomSchema), roomsController.create);

// PUT /api/rooms/:id — Update or (de)activate a room (admin only)
router.put('/:id', requirePermission('settings', 'edit'), validateParams(idParamSchema), validate(updateRoomSchema), roomsController.update);

// DELETE /api/rooms/:id — Delete a room no class uses (admin only)
router.delete('/:id', requirePermission('settings', 'edit'), validateParams(idParamSchema), roomsController.delete);

export default router;
