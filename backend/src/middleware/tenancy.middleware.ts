import { AsyncLocalStorage } from 'async_hooks';
import { schoolIsOpen, trialIsOver } from '../lib/demo';
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export interface TenantContext {
  schoolId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Express middleware that extracts school_id from the authenticated user's JWT
 * and stores it in AsyncLocalStorage for automatic tenant scoping.
 * Also rejects requests where body.school_id differs from the JWT-derived school_id.
 */
export async function tenancyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Skip tenancy enforcement for unauthenticated requests (public routes)
  if (!req.user) {
    next();
    return;
  }

  const { schoolId, role, userId } = req.user;

  // The token says who the user was when it was issued; the account says who
  // they are now. Deactivated, removed, or given another role since: the
  // token is refused (the client asks for a new one, or signs in again).
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, school: { select: { isActive: true, demoExpiresAt: true, trialEndsAt: true } } },
  });
  if (!account || !account.isActive || account.role !== role) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token' },
    });
    return;
  }

  // super_admin operates across all schools — skip tenant scoping entirely.
  // Their queries target explicit schoolId params/body, not filtered by JWT.
  if (role === 'super_admin') {
    next();
    return;
  }

  if (!schoolId) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No school association found for this user' },
    });
    return;
  }

  // Enforce school active status on every request (read with the account above)
  const school = account.school;
  if (!school || !schoolIsOpen(school)) {
    res.status(403).json({
      success: false,
      error: school && school.isActive && trialIsOver(school)
        ? { code: 'TRIAL_ENDED', message: 'The trial period of this school has ended' }
        : { code: 'SCHOOL_INACTIVE', message: 'School account is inactive' },
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
