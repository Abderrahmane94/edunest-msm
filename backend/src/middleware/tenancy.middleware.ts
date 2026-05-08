import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

export interface TenantContext {
  schoolId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Express middleware that extracts school_id from the authenticated user's JWT
 * and stores it in AsyncLocalStorage for automatic tenant scoping.
 * Also rejects requests where body.school_id differs from the JWT-derived school_id.
 */
export function tenancyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip tenancy enforcement for unauthenticated requests (public routes)
  if (!req.user) {
    next();
    return;
  }

  const { schoolId } = req.user;

  if (!schoolId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'No school association found for this user',
      },
    });
    return;
  }

  // Reject cross-tenant access attempts via request body
  const body = req.body as Record<string, unknown> | undefined;
  if (body && body.school_id && body.school_id !== schoolId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Cross-tenant access is not allowed',
      },
    });
    return;
  }

  // Also check schoolId in camelCase form
  if (body && body.schoolId && body.schoolId !== schoolId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Cross-tenant access is not allowed',
      },
    });
    return;
  }

  // Run the rest of the request within the tenant context
  tenantStorage.run({ schoolId }, () => {
    next();
  });
}

/**
 * Returns the current tenant's schoolId from AsyncLocalStorage.
 * Returns undefined if no tenant context is active.
 */
export function getCurrentSchoolId(): string | undefined {
  return tenantStorage.getStore()?.schoolId;
}
