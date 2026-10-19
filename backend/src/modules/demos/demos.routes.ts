import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireSuperAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { idParamSchema } from '../../utils/validators';
import { successResponse, errorResponse } from '../../utils/response';
import { demosService, DemoServiceError } from './demos.service';

const createDemoSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(8).max(20).regex(/^[0-9+ ().-]+$/, 'Invalid phone number'),
  schoolName: z.string().trim().max(100).optional(),
  language: z.enum(['fr', 'ar']).default('fr'),
});

const extendSchema = z.object({ days: z.number().int().min(1).max(30) });

const handle =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof DemoServiceError) {
        res.status(error.statusCode).json(errorResponse('DEMO_ERROR', error.message));
        return;
      }
      next(error);
    }
  };

const router = Router();

// GET /api/demos — The open demonstrations (super_admin)
router.get('/', requireSuperAdmin, handle(async (_req, res) => {
  res.status(200).json(successResponse(await demosService.list()));
}));

// POST /api/demos — A demonstration school for one director, filled with fictitious data
router.post('/', requireSuperAdmin, validate(createDemoSchema), handle(async (req, res) => {
  res.status(201).json(successResponse(await demosService.create(req.body)));
}));

// PATCH /api/demos/:id/extend — A few more days
router.patch('/:id/extend', requireSuperAdmin, validateParams(idParamSchema), validate(extendSchema), handle(async (req, res) => {
  res.status(200).json(successResponse(await demosService.extend(req.params.id, req.body.days)));
}));

// DELETE /api/demos/:id — Close a demonstration now
router.delete('/:id', requireSuperAdmin, validateParams(idParamSchema), handle(async (req, res) => {
  await demosService.end(req.params.id);
  res.status(200).json(successResponse({ message: 'Demonstration closed' }));
}));

export default router;
