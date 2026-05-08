import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';

// Route prefixes that don't require authentication.
// These are relative to the mount point (e.g., if mounted on /api, /auth matches /api/auth).
const PUBLIC_ROUTE_PREFIXES = ['/auth', '/users/register', '/finance/webhooks'];

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip authentication for public routes
  // When mounted via app.use('/api', authMiddleware), req.path is relative to /api
  if (PUBLIC_ROUTE_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
      },
    });
  }
}
