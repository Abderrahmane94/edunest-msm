import { Router } from 'express';
import { roomsController } from './rooms.controller';
import { requireAdmin, requireTeacherOrOffice } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createRoomSchema, updateRoomSchema } from './rooms.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// GET /api/rooms — List the school's rooms with their classes (admin or teacher)
router.get('/', requireTeacherOrOffice, roomsController.list);

// POST /api/rooms — Add a room (admin only)
router.post('/', requireAdmin, validate(createRoomSchema), roomsController.create);

// PUT /api/rooms/:id — Update or (de)activate a room (admin only)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateRoomSchema), roomsController.update);

// DELETE /api/rooms/:id — Delete a room no class uses (admin only)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), roomsController.delete);

export default router;
