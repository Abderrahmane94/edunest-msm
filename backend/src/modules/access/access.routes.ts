import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAdmin, requireActiveRole } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { idParamSchema } from '../../utils/validators';
import { successResponse, errorResponse } from '../../utils/response';
import { permissionsOf } from '../../middleware/permission.middleware';
import { accessService, AccessServiceError } from './access.service';
import { AREAS, type Permissions } from './permissions';

const level = z.enum(['none', 'view', 'edit']);
const permissionsSchema = z.object({
  areas: z.object(Object.fromEntries(AREAS.map((a) => [a, level])) as Record<(typeof AREAS)[number], typeof level>),
  delete: z.boolean(),
  correctPayments: z.boolean(),
});
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  permissions: permissionsSchema,
});
const updateSchema = createSchema.partial().extend({ isDefault: z.literal(true).optional() });
const assignSchema = z.object({ profileId: z.string().uuid() });

function handle(fn: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(status).json(successResponse(await fn(req)));
    } catch (error) {
      if (error instanceof AccessServiceError) {
        res.status(error.statusCode).json(errorResponse('ACCESS_ERROR', error.message));
        return;
      }
      next(error);
    }
  };
}

const router = Router();

// GET /api/access-profiles/me — The signed-in user's rights (to shape the app)
router.get(
  '/me',
  requireActiveRole,
  handle(async (req) => ({ role: req.user!.role, permissions: await permissionsOf(req) })),
);

// The profiles are the director's: nobody else can give themselves rights.
// GET /api/access-profiles — The school's profiles, with their staff
router.get('/', requireAdmin, handle((req) => accessService.list(req.user!.schoolId!)));

// POST /api/access-profiles — A new profile
router.post(
  '/',
  requireAdmin,
  validate(createSchema),
  handle((req) => accessService.create(req.user!.schoolId!, req.body as z.infer<typeof createSchema> & { permissions: Permissions }), 201),
);

// PUT /api/access-profiles/:id — Rename, change its rights, or make it the default
router.put(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateSchema),
  handle((req) => accessService.update(req.params.id, req.user!.schoolId!, req.body as z.infer<typeof updateSchema>)),
);

// DELETE /api/access-profiles/:id — Delete it (its staff get the default profile)
router.delete(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  handle(async (req) => {
    await accessService.delete(req.params.id, req.user!.schoolId!);
    return { message: 'Profile deleted' };
  }),
);

// PUT /api/access-profiles/users/:id — Give an office staff member a profile
router.put(
  '/users/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(assignSchema),
  handle(async (req) => {
    await accessService.assign(req.params.id, req.user!.schoolId!, (req.body as { profileId: string }).profileId);
    return { message: 'Profile assigned' };
  }),
);

export default router;
