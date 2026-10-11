import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { errorResponse } from '../../utils/response';

const isDirector = (role: string | undefined) => role === 'admin' || role === 'super_admin';

/**
 * Only a director makes or changes director accounts: staff allowed to
 * manage users can't create one, give the role, or act on an existing one
 * (edit, deactivate, reset, delete) — no way to raise their own rights.
 */
export async function protectDirectors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isDirector(req.user?.role)) return next();
    const body = (req.body ?? {}) as { role?: string };
    if (body.role === 'admin') {
      res.status(403).json(errorResponse('FORBIDDEN', 'Only the director can manage director accounts'));
      return;
    }
    const id = req.params.id;
    if (id) {
      const target = await prisma.user.findFirst({ where: { id }, select: { role: true } });
      if (target && isDirector(target.role)) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Only the director can manage director accounts'));
        return;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
