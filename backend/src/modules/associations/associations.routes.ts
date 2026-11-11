import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rbac, requireSuperAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { idParamSchema, uuidSchema, personNameSchema, optionalEmailSchema, optionalPhoneSchema, EMAIL_OR_PHONE } from '../../utils/validators';
import { successResponse, errorResponse } from '../../utils/response';
import {
  associationsService,
  AssociationServiceError,
  GROUP_TERMS,
  MEMBER_TERMS,
  type AssociationInput,
  type OfficerInput,
} from './associations.service';

const associationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  groupTerm: z.enum(GROUP_TERMS).optional(),
  memberTerm: z.enum(MEMBER_TERMS).optional(),
});

const officerSchema = z
  .object({
    firstName: personNameSchema(100),
    lastName: personNameSchema(100),
    email: optionalEmailSchema(),
    phone: optionalPhoneSchema(20),
    preferredLanguage: z.enum(['ar', 'fr']).optional().default('fr'),
  })
  .refine(EMAIL_OR_PHONE.check, EMAIL_OR_PHONE.message);

const overviewQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM').optional(),
});

const clubParamsSchema = z.object({ id: uuidSchema, schoolId: uuidSchema });
const officerParamsSchema = z.object({ id: uuidSchema, userId: uuidSchema });

const requireOfficer = rbac(['association']);

const handle =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof AssociationServiceError) {
        res.status(error.statusCode).json(errorResponse('ASSOCIATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  };

const router = Router();

// ─── The officer: their association's figures, nothing else ───

// GET /api/associations/me — The association and its clubs
router.get('/me', requireOfficer, handle(async (req, res) => {
  res.status(200).json(successResponse(await associationsService.mine(req.user!.userId)));
}));

// GET /api/associations/me/overview?month=YYYY-MM — Each club's figures and the total
router.get('/me/overview', requireOfficer, validateQuery(overviewQuerySchema), handle(async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  res.status(200).json(successResponse(await associationsService.overview(req.user!.userId, month)));
}));

// GET /api/associations/me/trend?month=YYYY-MM — The 12 months up to that one, per club and in total
router.get('/me/trend', requireOfficer, validateQuery(overviewQuerySchema), handle(async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  res.status(200).json(successResponse(await associationsService.trend(req.user!.userId, month)));
}));

// ─── The platform (super_admin) ───

// GET /api/associations — The associations, their clubs and officers
router.get('/', requireSuperAdmin, handle(async (_req, res) => {
  res.status(200).json(successResponse(await associationsService.list()));
}));

// POST /api/associations — A new group, with the words its client uses
router.post('/', requireSuperAdmin, validate(associationSchema), handle(async (req, res) => {
  res.status(201).json(successResponse(await associationsService.create(req.body as AssociationInput)));
}));

// PATCH /api/associations/:id — Its name, or its client's words
router.patch('/:id', requireSuperAdmin, validateParams(idParamSchema), validate(associationSchema.partial()), handle(async (req, res) => {
  res.status(200).json(successResponse(await associationsService.update(req.params.id, req.body as Partial<AssociationInput>)));
}));

// DELETE /api/associations/:id — Remove an empty association
router.delete('/:id', requireSuperAdmin, validateParams(idParamSchema), handle(async (req, res) => {
  await associationsService.remove(req.params.id);
  res.status(200).json(successResponse({ message: 'Association removed' }));
}));

// PUT /api/associations/:id/clubs/:schoolId — A school joins as a club
router.put('/:id/clubs/:schoolId', requireSuperAdmin, validateParams(clubParamsSchema), handle(async (req, res) => {
  await associationsService.addClub(req.params.id, req.params.schoolId);
  res.status(200).json(successResponse({ message: 'Club added' }));
}));

// DELETE /api/associations/:id/clubs/:schoolId — The club leaves (it keeps all its data)
router.delete('/:id/clubs/:schoolId', requireSuperAdmin, validateParams(clubParamsSchema), handle(async (req, res) => {
  await associationsService.removeClub(req.params.id, req.params.schoolId);
  res.status(200).json(successResponse({ message: 'Club removed' }));
}));

// POST /api/associations/:id/officers — An officer's account (first password told once)
router.post('/:id/officers', requireSuperAdmin, validateParams(idParamSchema), validate(officerSchema), handle(async (req, res) => {
  res.status(201).json(successResponse(await associationsService.addOfficer(req.params.id, req.body as OfficerInput)));
}));

// DELETE /api/associations/:id/officers/:userId — Close an officer's account
router.delete('/:id/officers/:userId', requireSuperAdmin, validateParams(officerParamsSchema), handle(async (req, res) => {
  await associationsService.removeOfficer(req.params.id, req.params.userId);
  res.status(200).json(successResponse({ message: 'Officer removed' }));
}));

export default router;
