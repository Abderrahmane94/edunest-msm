import { Router } from 'express';
import { childrenController } from './children.controller';
import { requireAdmin, requireTeacherOrAdmin, requireActiveRole } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { createChildSchema, updateChildSchema, enrollChildSchema, createParentLinkSchema, parentLinkParamsSchema, createEmergencyContactSchema, updateEmergencyContactSchema, emergencyContactParamsSchema } from './children.schema';
import { idParamSchema } from '../../utils/validators';

const router = Router();

// POST /api/children — Register a child (admin only)
router.post('/', requireAdmin, validate(createChildSchema), childrenController.create);

// GET /api/children — List children in school (admin or teacher)
router.get('/', requireTeacherOrAdmin, childrenController.list);

// GET /api/children/:id — Get child by ID (admin, teacher, or parent)
router.get('/:id', requireActiveRole, validateParams(idParamSchema), childrenController.getById);

// PUT /api/children/:id — Update child (admin only)
router.put('/:id', requireAdmin, validateParams(idParamSchema), validate(updateChildSchema), childrenController.update);

// DELETE /api/children/:id — Soft delete child (admin only)
router.delete('/:id', requireAdmin, validateParams(idParamSchema), childrenController.delete);

// POST /api/children/:id/enroll — Enroll child in classroom (admin only)
router.post('/:id/enroll', requireAdmin, validateParams(idParamSchema), validate(enrollChildSchema), childrenController.enroll);

// POST /api/children/:id/photo — Upload child photo (admin only)
router.post('/:id/photo', requireAdmin, validateParams(idParamSchema), childrenController.uploadPhoto);

// GET /api/children/:id/photo-url — Get signed photo URL (admin, teacher, or parent)
router.get('/:id/photo-url', requireActiveRole, validateParams(idParamSchema), childrenController.getPhotoUrl);

// ─── Parent-Child Links ──────────────────────────────────────────────────────

// POST /api/children/:id/parent-links — Create parent-child link (admin only)
router.post('/:id/parent-links', requireAdmin, validateParams(idParamSchema), validate(createParentLinkSchema), childrenController.createParentLink);

// GET /api/children/:id/parent-links — List parent links for a child (admin or teacher)
router.get('/:id/parent-links', requireTeacherOrAdmin, validateParams(idParamSchema), childrenController.getParentLinks);

// DELETE /api/children/:id/parent-links/:linkId — Remove a parent-child link (admin only)
router.delete('/:id/parent-links/:linkId', requireAdmin, validateParams(parentLinkParamsSchema), childrenController.removeParentLink);

// PATCH /api/children/:id/parent-links/:linkId/primary — Set link as primary (admin only)
router.patch('/:id/parent-links/:linkId/primary', requireAdmin, validateParams(parentLinkParamsSchema), childrenController.setPrimaryLink);

// ─── Emergency Contacts ──────────────────────────────────────────────────────

// POST /api/children/:id/emergency-contacts — Add emergency contact (admin only)
router.post('/:id/emergency-contacts', requireAdmin, validateParams(idParamSchema), validate(createEmergencyContactSchema), childrenController.addEmergencyContact);

// GET /api/children/:id/emergency-contacts — List emergency contacts (admin or teacher)
router.get('/:id/emergency-contacts', requireTeacherOrAdmin, validateParams(idParamSchema), childrenController.getEmergencyContacts);

// PUT /api/children/:id/emergency-contacts/:contactId — Update emergency contact (admin only)
router.put('/:id/emergency-contacts/:contactId', requireAdmin, validateParams(emergencyContactParamsSchema), validate(updateEmergencyContactSchema), childrenController.updateEmergencyContact);

// DELETE /api/children/:id/emergency-contacts/:contactId — Delete emergency contact (admin only)
router.delete('/:id/emergency-contacts/:contactId', requireAdmin, validateParams(emergencyContactParamsSchema), childrenController.removeEmergencyContact);

export default router;
