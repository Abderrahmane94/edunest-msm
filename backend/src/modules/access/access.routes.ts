import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAdmin, requireActiveRole } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { idParamSchema, isoDateSchema } from '../../utils/validators';
import { successResponse, errorResponse } from '../../utils/response';
import { permissionsOf } from '../../middleware/permission.middleware';
import { accessService, AccessServiceError, EXCEPTION_KEYS } from './access.service';
import { AREAS, type Permissions } from './permissions';

// An area the page does not know yet (a new one, before the page is reloaded) is taken as closed.
const level = z.enum(['none', 'view', 'edit']).default('none');
const permissionsSchema = z.object({
  areas: z.object(Object.fromEntries(AREAS.map((a) => [a, level])) as Record<(typeof AREAS)[number], typeof level>),
  delete: z.boolean(),
  correctPayments: z.boolean(),
  collectCash: z.boolean().default(false),
});
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  permissions: permissionsSchema,
});
const updateSchema = createSchema.partial().extend({ isDefault: z.literal(true).optional() });
const assignSchema = z.object({ profileId: z.string().uuid() });
const exceptionSchema = z.object({
  area: z.enum(EXCEPTION_KEYS),
  level: level,
  endsOn: isoDateSchema.nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
});
const exceptionParamsSchema = z.object({ id: z.string().uuid(), exceptionId: z.string().uuid() });

/** The director acting: kept in the journal. */
const actor = (req: Request) => ({ userId: req.user!.userId, schoolId: req.user!.schoolId! });

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
  handle((req) => accessService.create(actor(req), req.body as z.infer<typeof createSchema> & { permissions: Permissions }), 201),
);

// PUT /api/access-profiles/:id — Rename, change its rights, or make it the default
router.put(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateSchema),
  handle((req) => accessService.update(actor(req), req.params.id, req.body as z.infer<typeof updateSchema>)),
);

// DELETE /api/access-profiles/:id — Delete it (its staff get the default profile)
router.delete(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  handle(async (req) => {
    await accessService.delete(actor(req), req.params.id);
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
    await accessService.assign(actor(req), req.params.id, (req.body as { profileId: string }).profileId);
    return { message: 'Profile assigned' };
  }),
);

// GET /api/access-profiles/journal?user_id=&profile_id= — Who changed which rights, when
router.get(
  '/journal',
  requireAdmin,
  handle((req) =>
    accessService.journal(req.user!.schoolId!, {
      userId: typeof req.query.user_id === 'string' ? req.query.user_id : undefined,
      profileId: typeof req.query.profile_id === 'string' ? req.query.profile_id : undefined,
    }),
  ),
);

// GET /api/access-profiles/users/:id/exceptions — A person's exceptions
router.get('/users/:id/exceptions', requireAdmin, validateParams(idParamSchema), handle((req) => accessService.exceptionsOf(req.params.id, req.user!.schoolId!)));

// PUT /api/access-profiles/users/:id/exceptions — Set one (an area differing from the profile)
router.put(
  '/users/:id/exceptions',
  requireAdmin,
  validateParams(idParamSchema),
  validate(exceptionSchema),
  handle((req) => accessService.setException(actor(req), req.params.id, req.body as z.infer<typeof exceptionSchema>)),
);

// DELETE /api/access-profiles/users/:id/exceptions/:exceptionId — Remove one
router.delete(
  '/users/:id/exceptions/:exceptionId',
  requireAdmin,
  validateParams(exceptionParamsSchema),
  handle(async (req) => {
    await accessService.removeException(actor(req), req.params.id, req.params.exceptionId);
    return { message: 'Exception removed' };
  }),
);

export default router;
