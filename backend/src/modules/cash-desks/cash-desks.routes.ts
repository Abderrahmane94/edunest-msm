import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { permissionsOf, requireAnyOffice, requirePermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { idParamSchema } from '../../utils/validators';
import { successResponse, errorResponse } from '../../utils/response';
import { cashDesksService, CashDeskServiceError, type CollectInput } from './cash-desks.service';

const amount = z.number().min(0).max(99999999.99);
const collectSchema = z.object({
  countedAmount: amount,
  floatLeft: amount.default(0),
  expectedAmount: z.number().min(-99999999.99).max(99999999.99),
  reason: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  /** Id made by the form: the same handover sent twice is saved once. */
  clientId: z.string().uuid().optional(),
});
const settingsSchema = z.object({
  cashAlertAmount: amount,
  cashAlertDays: z.number().int().min(0).max(365),
});

const actor = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role, schoolId: req.user!.schoolId! });

function handle(fn: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(status).json(successResponse(await fn(req)));
    } catch (error) {
      if (error instanceof CashDeskServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  };
}

/** Collectors see every desk; the others only their own. */
async function ownDeskOnly(req: Request): Promise<string | undefined> {
  return (await permissionsOf(req)).collectCash ? undefined : req.user!.userId;
}

const collector = requirePermission('collections', 'view', { collectCash: true });
const router = Router();

// GET /api/cash-desks/summary — My desk and the desks due, for the dashboard (office)
router.get('/summary', requireAnyOffice(), handle((req) => cashDesksService.summary(actor(req))));

// GET /api/cash-desks/mine — What is in my desk (whoever records payments)
router.get('/mine', requirePermission('collections', 'edit'), handle((req) => cashDesksService.desk(req.user!.userId, req.user!.schoolId!)));

// GET /api/cash-desks/handovers?cashier_id= — Past handovers (collectors: all; others: their own)
router.get(
  '/handovers',
  requirePermission('collections', 'view'),
  handle(async (req) => {
    const asked = typeof req.query.cashier_id === 'string' && req.query.cashier_id ? req.query.cashier_id : undefined;
    return cashDesksService.handovers(req.user!.schoolId!, (await ownDeskOnly(req)) ?? asked);
  }),
);

// GET /api/cash-desks/handovers/:id — One handover with what it counted (the slip)
router.get(
  '/handovers/:id',
  requirePermission('collections', 'view'),
  validateParams(idParamSchema),
  handle(async (req) => cashDesksService.handover(req.params.id, req.user!.schoolId!, await ownDeskOnly(req))),
);

// PUT /api/cash-desks/settings — When a desk is due for a handover (settings)
router.put(
  '/settings',
  requirePermission('settings', 'edit'),
  validate(settingsSchema),
  handle((req) => cashDesksService.updateSettings(req.user!.schoolId!, req.body as z.infer<typeof settingsSchema>)),
);

// GET /api/cash-desks — Every desk of the school (collectors)
router.get('/', collector, handle((req) => cashDesksService.list(req.user!.schoolId!)));

// GET /api/cash-desks/:id — A person's desk, with what is in it (collectors)
router.get('/:id', collector, validateParams(idParamSchema), handle((req) => cashDesksService.desk(req.params.id, req.user!.schoolId!)));

// POST /api/cash-desks/:id/collect — Count it and take the money (collectors)
router.post(
  '/:id/collect',
  collector,
  validateParams(idParamSchema),
  validate(collectSchema),
  handle((req) => cashDesksService.collect(actor(req), req.params.id, req.body as CollectInput), 201),
);

export default router;
