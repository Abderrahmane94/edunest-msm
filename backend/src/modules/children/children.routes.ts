import { Router } from 'express';
import multer from 'multer';
import { childrenController } from './children.controller';
import { rbac, requireActiveRole } from '../../middleware/rbac.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { registerChildSchema, createChildSchema, updateChildSchema, enrollChildSchema, createParentLinkSchema, updateParentLinkSchema, parentLinkParamsSchema, createEmergencyContactSchema, updateEmergencyContactSchema, emergencyContactParamsSchema, createMedicalNoteSchema, updateMedicalNoteSchema, medicalNoteParamsSchema } from './children.schema';
import { idParamSchema } from '../../utils/validators';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';

// A child's photo: an image, already made small by the app (the limit is generous).
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG and WebP images are allowed'));
  },
});

const router = Router();

// POST /api/children — Register a child (admin only)
router.post('/', requirePermission('children', 'edit'), validate(createChildSchema), rejectClosedYear(yearOf.body()), childrenController.create);

// POST /api/children/register — Register a child and everything around it in one transaction (admin only)
router.post(
  '/register',
  requirePermission('children', 'edit'),
  validate(registerChildSchema),
  rejectClosedYear(async (req) => {
    const body = req.body as { child: { academicYearId: string }; classroomId?: string };
    return [body.child.academicYearId, await yearOf.classroom(body.classroomId)];
  }),
  childrenController.register,
);

// GET /api/children — List children in school (admin or teacher)
router.get('/', requireAnyPermission([['children', 'view'], ['classes', 'view'], ['collections', 'view'], ['communication', 'view']], { alsoRoles: ['teacher'] }), childrenController.list);

// GET /api/children/:id — Get child by ID (admin, teacher, or parent)
// GET /api/children/mine — A parent's own children, with their photos
router.get('/mine', rbac(['parent']), childrenController.mine);

router.get('/:id', requireActiveRole, validateParams(idParamSchema), childrenController.getById);

// PUT /api/children/:id — Update child (admin only)
router.put('/:id', requirePermission('children', 'edit'), validateParams(idParamSchema), validate(updateChildSchema), childrenController.update);

// DELETE /api/children/:id — Soft delete child (admin only)
router.delete('/:id', requirePermission('children', 'edit', { delete: true }), validateParams(idParamSchema), childrenController.delete);

// POST /api/children/:id/enroll — Enroll child in classroom (admin only)
router.post('/:id/enroll', requireAnyPermission([['children', 'edit'], ['classes', 'edit']]), validateParams(idParamSchema), validate(enrollChildSchema), rejectClosedYear((req) => yearOf.classroom((req.body as { classroomId: string }).classroomId)), childrenController.enroll);

// POST /api/children/:id/photo — The child's photo, with the parents' agreement (office, or a parent of the child)
router.post('/:id/photo', requirePermission('children', 'edit', { alsoRoles: ['parent'] }), validateParams(idParamSchema), photoUpload.single('photo'), childrenController.uploadPhoto);

// DELETE /api/children/:id/photo — Remove it (office, or a parent of the child)
router.delete('/:id/photo', requirePermission('children', 'edit', { alsoRoles: ['parent'] }), validateParams(idParamSchema), childrenController.removePhoto);

// GET /api/children/:id/photo-url — Get signed photo URL (admin, teacher, or parent)
router.get('/:id/photo-url', requireActiveRole, validateParams(idParamSchema), childrenController.getPhotoUrl);

// ─── Parent-Child Links ──────────────────────────────────────────────────────

// POST /api/children/:id/parent-links — Create parent-child link (admin only)
router.post('/:id/parent-links', requirePermission('children', 'edit'), validateParams(idParamSchema), validate(createParentLinkSchema), childrenController.createParentLink);

// GET /api/children/:id/parent-links — List parent links for a child (admin or teacher)
router.get('/:id/parent-links', requirePermission('children', 'view', { alsoRoles: ['teacher'] }), validateParams(idParamSchema), childrenController.getParentLinks);

// PUT /api/children/:id/parent-links/:linkId — Update a parent-child link's relationship (admin only)
router.put('/:id/parent-links/:linkId', requirePermission('children', 'edit'), validateParams(parentLinkParamsSchema), validate(updateParentLinkSchema), childrenController.updateParentLink);

// DELETE /api/children/:id/parent-links/:linkId — Remove a parent-child link (admin only)
router.delete('/:id/parent-links/:linkId', requirePermission('children', 'edit'), validateParams(parentLinkParamsSchema), childrenController.removeParentLink);

// PATCH /api/children/:id/parent-links/:linkId/primary — Set link as primary (admin only)
router.patch('/:id/parent-links/:linkId/primary', requirePermission('children', 'edit'), validateParams(parentLinkParamsSchema), childrenController.setPrimaryLink);

// ─── Emergency Contacts ──────────────────────────────────────────────────────

// POST /api/children/:id/emergency-contacts — Add emergency contact (admin only)
router.post('/:id/emergency-contacts', requirePermission('children', 'edit'), validateParams(idParamSchema), validate(createEmergencyContactSchema), childrenController.addEmergencyContact);

// GET /api/children/:id/emergency-contacts — List emergency contacts (admin or teacher)
router.get('/:id/emergency-contacts', requirePermission('children', 'view', { alsoRoles: ['teacher'] }), validateParams(idParamSchema), childrenController.getEmergencyContacts);

// PUT /api/children/:id/emergency-contacts/:contactId — Update emergency contact (admin only)
router.put('/:id/emergency-contacts/:contactId', requirePermission('children', 'edit'), validateParams(emergencyContactParamsSchema), validate(updateEmergencyContactSchema), childrenController.updateEmergencyContact);

// DELETE /api/children/:id/emergency-contacts/:contactId — Delete emergency contact (admin only)
router.delete('/:id/emergency-contacts/:contactId', requirePermission('children', 'edit'), validateParams(emergencyContactParamsSchema), childrenController.removeEmergencyContact);

// ─── Medical Notes ───────────────────────────────────────────────────────────

// POST /api/children/:id/medical-notes — Add medical note (admin only)
router.post('/:id/medical-notes', requirePermission('children', 'edit'), validateParams(idParamSchema), validate(createMedicalNoteSchema), childrenController.addMedicalNote);

// GET /api/children/:id/medical-notes — List medical notes (admin, or teacher for their own classroom)
router.get('/:id/medical-notes', requirePermission('children', 'view', { alsoRoles: ['teacher'] }), validateParams(idParamSchema), childrenController.getMedicalNotes);

// PUT /api/children/:id/medical-notes/:noteId — Update medical note (admin only)
router.put('/:id/medical-notes/:noteId', requirePermission('children', 'edit'), validateParams(medicalNoteParamsSchema), validate(updateMedicalNoteSchema), childrenController.updateMedicalNote);

// DELETE /api/children/:id/medical-notes/:noteId — Delete medical note (admin only)
router.delete('/:id/medical-notes/:noteId', requirePermission('children', 'edit'), validateParams(medicalNoteParamsSchema), childrenController.removeMedicalNote);

export default router;
