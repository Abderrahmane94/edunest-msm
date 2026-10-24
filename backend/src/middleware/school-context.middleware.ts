import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

/**
 * A school's own routes need a school. The platform account (super_admin)
 * belongs to none: instead of reaching the database without one (a 500), it
 * gets a clear answer. The other roles always have a school — the tenancy
 * middleware refuses them otherwise.
 *
 * `except`: the paths (relative to the mount) the platform account does use
 * on its own terms, e.g. naming the school in the body.
 */
export function requireSchoolContext(options: { except?: RegExp[] } = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== 'super_admin' || req.user.schoolId) {
      next();
      return;
    }
    if (options.except?.some((pattern) => pattern.test(req.path))) {
      next();
      return;
    }
    res
      .status(400)
      .json(errorResponse('NO_SCHOOL_CONTEXT', 'This belongs to a school, and the platform account has none'));
  };
}
