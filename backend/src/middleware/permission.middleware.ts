import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { accessService } from '../modules/access/access.service';
import { allows, type Area, type Permissions } from '../modules/access/permissions';
import { errorResponse } from '../utils/response';

export const NOT_ALLOWED_MESSAGE = 'Your profile does not allow this';

/** The request user's rights, loaded once per request. */
export async function permissionsOf(req: Request): Promise<Permissions> {
  if (!req.permissions) req.permissions = await accessService.permissionsOf(req.user!);
  return req.permissions;
}

/** Whether the request user may do this (for checks inside handlers). */
export async function can(req: Request, area: Area, level: 'view' | 'edit' = 'view'): Promise<boolean> {
  return allows(await permissionsOf(req), area, level);
}

type Need = [Area, 'view' | 'edit'];
interface Options {
  /** Roles let in on their own rules (e.g. teachers on their class). */
  alsoRoles?: UserRole[];
  /** Also needs the right to delete. */
  delete?: boolean;
  /** Also needs the right to correct payments. */
  correctPayments?: boolean;
}

function guard(needs: Need[], options: Options) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.user?.role;
      if (!role) return next();
      if (options.alsoRoles?.includes(role)) return next();
      const office = role === 'admin' || role === 'super_admin' || role === 'administrative';
      if (office) {
        const p = await permissionsOf(req);
        const ok =
          needs.some(([area, level]) => allows(p, area, level)) &&
          (!options.delete || p.delete) &&
          (!options.correctPayments || p.correctPayments);
        if (ok) return next();
      }
      res.status(403).json(errorResponse('FORBIDDEN', NOT_ALLOWED_MESSAGE));
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Lets in the office staff whose profile reaches `level` in `area` (the
 * director always), and the `alsoRoles` on their own rules.
 */
export function requirePermission(area: Area, level: 'view' | 'edit' = 'view', options: Options = {}) {
  return guard([[area, level]], options);
}

/** Lets in whoever has any one of these rights (reading shared lists: children, classes…). */
export function requireAnyPermission(needs: Need[], options: Options = {}) {
  return guard(needs, options);
}

/** Lookups every office member needs whatever their profile (years, branches, rooms…). */
export function requireAnyOffice(options: Options = {}) {
  return guard(
    [['children', 'view'], ['classes', 'view'], ['communication', 'view'], ['inventory', 'view'], ['collections', 'view'],
     ['expenses', 'view'], ['fees', 'view'], ['payroll', 'view'], ['staff', 'view'], ['settings', 'view']],
    options,
  );
}
