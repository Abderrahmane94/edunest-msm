import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireSuperAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { idParamSchema } from '../../utils/validators';
import { successResponse, errorResponse } from '../../utils/response';
import { ordersService, OrderServiceError, normalizePhone } from './orders.service';

const text = (max: number) => z.string().trim().max(max);

export const publicOrderSchema = z.object({
  plan: z.enum(['small', 'standard', 'network']),
  cycle: z.enum(['monthly', 'annual']).default('monthly'),
  directorName: text(80).min(2),
  nurseryName: text(100).optional(),
  phone: text(20).refine((p) => /^0[5-7]\d{8}$|^0[2-4]\d{7,8}$/.test(normalizePhone(p)), 'Invalid phone number'),
  wilaya: z.string().regex(/^(0[1-9]|[1-5]\d)$/).refine((w) => Number(w) <= 58, 'Invalid wilaya'),
  childrenCount: z.number().int().min(1).max(5000).optional(),
  language: z.enum(['fr', 'ar']).default('fr'),
  source: text(40).optional(),
  /** The honeypot: a person never sees it, a robot fills it. */
  website: z.string().max(200).optional(),
  tracking: z
    .object({
      eventId: text(64).optional(),
      fbp: text(200).optional(),
      fbc: text(300).optional(),
      pageUrl: text(500).optional(),
      utm: z.record(z.string().regex(/^utm_[a-z]+$|^fbclid$/), text(200)).optional(),
    })
    .optional(),
});

const updateSchema = z.object({
  status: z.enum(['new', 'contacted', 'won', 'lost']).optional(),
  note: z.string().max(2000).nullable().optional(),
});

const listQuerySchema = z.object({ status: z.enum(['new', 'contacted', 'won', 'lost']).optional() });

const handle =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof OrderServiceError) {
        res.status(error.statusCode).json(errorResponse('ORDER_ERROR', error.message));
        return;
      }
      next(error);
    }
  };

/** A few orders per visitor and per quarter hour: enough for a real one, not for a robot. */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('RATE_LIMIT_EXCEEDED', 'Too many orders, please try again later'),
});

const router = Router();

// POST /api/orders/public — An order from a landing page (no account)
router.post('/public', publicLimiter, validate(publicOrderSchema), handle(async (req, res) => {
  const { website, ...input } = req.body as z.infer<typeof publicOrderSchema>;
  // A robot filled the hidden field: it is told all went well, and nothing is saved.
  if (website) {
    res.status(201).json(successResponse({ number: '' }));
    return;
  }
  const order = await ordersService.createPublic(input, {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 400) ?? null,
  });
  res.status(201).json(successResponse({ number: order.number }));
}));

// GET /api/orders — Every order, the newest first (super_admin)
router.get('/', requireSuperAdmin, validateQuery(listQuerySchema), handle(async (req, res) => {
  res.status(200).json(successResponse(await ordersService.list(req.query.status as z.infer<typeof listQuerySchema>['status'])));
}));

// PATCH /api/orders/:id — The team's follow-up: status and note (super_admin)
router.patch('/:id', requireSuperAdmin, validateParams(idParamSchema), validate(updateSchema), handle(async (req, res) => {
  res.status(200).json(successResponse(await ordersService.update(req.params.id, req.body as z.infer<typeof updateSchema>)));
}));

export default router;
