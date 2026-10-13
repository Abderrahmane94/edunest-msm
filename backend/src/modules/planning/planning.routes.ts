import { Router, type NextFunction, type Request, type Response } from 'express';
import { can, requireAnyPermission, requirePermission, NOT_ALLOWED_MESSAGE } from '../../middleware/permission.middleware';
import { validate, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { errorResponse, successResponse } from '../../utils/response';
import { idParamSchema } from '../../utils/validators';
import {
  absencesQuerySchema,
  createAbsenceSchema,
  shiftsSchema,
  summaryQuerySchema,
  updateAbsenceSchema,
  userParamSchema,
  weekQuerySchema,
  type CreateAbsenceInput,
  type ShiftsInput,
  type UpdateAbsenceInput,
} from './planning.schema';
import { planningService, PlanningServiceError } from './planning.service';

const router = Router();

function handle(fn: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(status).json(successResponse(await fn(req)));
    } catch (error) {
      if (error instanceof PlanningServiceError) {
        res.status(error.statusCode).json(errorResponse(error.statusCode === 409 ? 'CONFLICT' : 'PLANNING_ERROR', error.message));
        return;
      }
      next(error);
    }
  };
}

/** Today where the school is (Algeria is an hour ahead of UTC all year). */
const today = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10);

// GET /api/planning/week?start= — The team's week; for who does not manage the team, their own week
router.get('/week', validateQuery(weekQuerySchema), async (req, res, next) => {
  const role = req.user!.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'administrative' && role !== 'teacher') {
    res.status(403).json(errorResponse('FORBIDDEN', NOT_ALLOWED_MESSAGE));
    return;
  }
  const whole = role !== 'teacher' && (await can(req, 'staff', 'view'));
  const start = (req.query as { start?: string }).start ?? today();
  await handle(async () => ({ ...(await planningService.week(req.user!.schoolId!, start, whole ? undefined : req.user!.userId)), whole, today: today() }))(req, res, next);
});

// PUT /api/planning/shifts/:userId — A person's usual week
router.put(
  '/shifts/:userId',
  requirePermission('staff', 'edit'),
  validateParams(userParamSchema),
  validate(shiftsSchema),
  handle((req) => planningService.setShifts(req.user!.schoolId!, req.params.userId, req.body as ShiftsInput)),
);

// GET /api/planning/absences?from=&to= — The absences recorded over a period
router.get(
  '/absences',
  requirePermission('staff', 'view'),
  validateQuery(absencesQuerySchema),
  handle((req) => {
    const q = req.query as { from: string; to: string; userId?: string };
    return planningService.absences(req.user!.schoolId!, q.from, q.to, q.userId);
  }),
);

// POST /api/planning/absences — Record an absence
router.post(
  '/absences',
  requirePermission('staff', 'edit'),
  validate(createAbsenceSchema),
  handle((req) => planningService.createAbsence(req.user!.schoolId!, req.user!.userId, req.body as CreateAbsenceInput), 201),
);

// PUT /api/planning/absences/:id — Change its dates, reason or note
router.put(
  '/absences/:id',
  requirePermission('staff', 'edit'),
  validateParams(idParamSchema),
  validate(updateAbsenceSchema),
  handle((req) => planningService.updateAbsence(req.params.id, req.user!.schoolId!, req.body as UpdateAbsenceInput)),
);

// DELETE /api/planning/absences/:id
router.delete(
  '/absences/:id',
  requirePermission('staff', 'edit'),
  validateParams(idParamSchema),
  handle(async (req) => {
    await planningService.deleteAbsence(req.params.id, req.user!.schoolId!);
    return { deleted: true };
  }),
);

// GET /api/planning/summary?month= — Hours planned, away and worked, person by person (the team's managers, the payroll)
router.get(
  '/summary',
  requireAnyPermission([['staff', 'view'], ['payroll', 'view']]),
  validateQuery(summaryQuerySchema),
  handle((req) => {
    const q = req.query as { month: string; userId?: string };
    return planningService.summary(req.user!.schoolId!, q.month, today(), q.userId);
  }),
);

export default router;

