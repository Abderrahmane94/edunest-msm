import { Request, Response, NextFunction } from 'express';
import { branchConfigService, BranchConfigServiceError } from './branch-config.service';
import { createBranchConfigSchema, updateBranchConfigSchema } from './payments.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchAccess } from './tenant-scope.middleware';
import { ZodError } from 'zod';
import prisma from '../../lib/prisma';

/**
 * Normalize camelCase keys to snake_case for branch config requests.
 * Accepts both formats so the API works with camelCase frontend and snake_case direct calls.
 */
function normalizeBranchConfigBody(body: Record<string, unknown>): Record<string, unknown> {
  const mapping: Record<string, string> = {
    billingCycle: 'billing_cycle',
    billingDueDay: 'billing_due_day',
    gracePeriodDays: 'grace_period_days',
    defaultRecurringFee: 'default_recurring_fee',
    notificationSetting: 'notification_setting',
  };
  const result: Record<string, unknown> = { ...body };
  for (const [camel, snake] of Object.entries(mapping)) {
    if (camel in result && !(snake in result)) {
      result[snake] = result[camel];
      delete result[camel];
    }
  }
  return result;
}

/** Roles considered "Staff" for billing configuration access. */
const STAFF_ROLES = ['admin', 'super_admin'] as const;

export const branchConfigController = {
  /**
   * GET /api/payments/branches
   * List branches for the user's school.
   */
  async listBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const scope = req.tenantScope;
      let branches: { id: string; name: string; isActive: boolean }[];

      if (scope?.isSuperAdmin) {
        // Super admin sees all branches (edge case, normally scoped)
        branches = await prisma.branch.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' },
        });
      } else if (scope?.schoolId) {
        branches = await prisma.branch.findMany({
          where: { schoolId: scope.schoolId, deletedAt: null },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' },
        });
      } else {
        branches = [];
      }

      res.status(200).json(successResponse(branches));
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/payments/branches
   * Create a new branch for the user's school.
   */
  async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const scope = req.tenantScope;
      if (!scope || (!scope.schoolId && !scope.isSuperAdmin)) {
        res.status(403).json(errorResponse('FORBIDDEN', 'No school association found'));
        return;
      }

      const { name, address } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Branch name is required (1-255 characters)'),
        );
        return;
      }

      if (name.trim().length > 255) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Branch name must not exceed 255 characters'),
        );
        return;
      }

      // For super_admin, require schoolId in body
      let schoolId = scope.schoolId;
      if (scope.isSuperAdmin) {
        schoolId = req.body.schoolId;
        if (!schoolId) {
          res.status(400).json(
            errorResponse('VALIDATION_ERROR', 'schoolId is required for super_admin'),
          );
          return;
        }
      }

      const branch = await prisma.branch.create({
        data: {
          schoolId: schoolId!,
          name: name.trim(),
          address: address?.trim() || null,
          isActive: true,
        },
        select: { id: true, name: true, address: true, isActive: true, createdAt: true },
      });

      res.status(201).json(successResponse(branch));
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/payments/branches/:branchId
   * Update a branch (name, address, isActive).
   */
  async updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { branchId } = req.params;

      // Validate branch access
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      const data: Record<string, unknown> = {};

      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (name.length < 1 || name.length > 255) {
          res.status(400).json(
            errorResponse('VALIDATION_ERROR', 'Branch name must be 1-255 characters'),
          );
          return;
        }
        data.name = name;
      }

      if (req.body.address !== undefined) {
        data.address = req.body.address?.trim() || null;
      }

      if (req.body.isActive !== undefined) {
        data.isActive = Boolean(req.body.isActive);
      }

      if (Object.keys(data).length === 0) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'No fields to update'),
        );
        return;
      }

      const branch = await prisma.branch.update({
        where: { id: validatedBranch },
        data,
        select: { id: true, name: true, address: true, isActive: true, createdAt: true },
      });

      res.status(200).json(successResponse(branch));
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/payments/branches/:branchId/config
   * Create billing configuration for a branch.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { branchId } = req.params;

      // Validate branch access (Req 20.1, 20.2, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      // Validate request body (accept both camelCase and snake_case)
      const normalized = normalizeBranchConfigBody(req.body);
      const parsed = createBranchConfigSchema.safeParse(normalized);
      if (!parsed.success) {
        const details = mapZodErrors(parsed.error);
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }

      const config = await branchConfigService.createConfig(validatedBranch, parsed.data);
      res.status(201).json(successResponse(config));
    } catch (error) {
      if (error instanceof BranchConfigServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/payments/branches/:branchId/config
   * Update billing configuration for a branch.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { branchId } = req.params;

      // Validate branch access (Req 20.1, 20.2, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      // Validate request body (accept both camelCase and snake_case)
      const normalized = normalizeBranchConfigBody(req.body);
      const parsed = updateBranchConfigSchema.safeParse(normalized);
      if (!parsed.success) {
        const details = mapZodErrors(parsed.error);
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }

      const result = await branchConfigService.updateConfig(validatedBranch, parsed.data);
      res.status(200).json(
        successResponse({
          ...result.config,
          unchangedPeriodsCount: result.unchangedPeriodsCount,
        }),
      );
    } catch (error) {
      if (error instanceof BranchConfigServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/branches/:branchId/config
   * Get billing configuration for a branch.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { branchId } = req.params;

      // Validate branch access (Req 20.1, 20.2, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      const config = await branchConfigService.getConfig(validatedBranch);

      if (!config) {
        res.status(404).json(
          errorResponse('NOT_FOUND', 'No billing configuration found for this branch'),
        );
        return;
      }

      res.status(200).json(successResponse(config));
    } catch (error) {
      if (error instanceof BranchConfigServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },
};

/**
 * Map Zod validation errors to the standard FieldError[] format.
 */
function mapZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
