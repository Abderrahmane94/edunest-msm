import { errorHandler } from './middleware/error.middleware';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.middleware';
import { tenancyMiddleware } from './middleware/tenancy.middleware';
import { errorResponse } from './utils/response';
import { verifyUploadPath } from './services/cloudinary.service';
import authRoutes from './modules/auth/auth.routes';
import schoolRoutes from './modules/schools/schools.routes';
import userRoutes from './modules/users/users.routes';
import staffRoutes from './modules/staff/staff.routes';
import academicYearRoutes from './modules/academic-years/academic-years.routes';
import classroomRoutes from './modules/classrooms/classrooms.routes';
import childrenRoutes from './modules/children/children.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import communicationRoutes from './modules/communication/communication.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import adminRoutes from './modules/admin/admin.routes';
import billingRoutes from './modules/billing/billing.routes';
import trashRoutes from './modules/trash/trash.routes';
import timetableRoutes from './modules/timetable/timetable.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import paymentRoutes from './modules/payments';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').concat(['http://localhost:5174']),
    credentials: true,
  }),
);

// Body parsing. The receipt email carries the receipt PDF (base64), so that
// one route accepts a larger body; everything else keeps the 100 KB default.
app.use(/^\/api\/payments\/records\/[^/]+\/receipt\/email$/, express.json({ limit: '4mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files behind a signed, expiring URL (see cloudinaryService.generateSignedUrl)
function verifyUploadsAccess(req: Request, res: Response, next: NextFunction): void {
  const publicId = req.path.replace(/^\//, '');
  const expires = Number(req.query.expires);
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!token || !verifyUploadPath(publicId, expires, token)) {
    res.status(403).json(errorResponse('FORBIDDEN', 'Invalid or expired file link'));
    return;
  }
  next();
}

app.use('/uploads', verifyUploadsAccess, express.static(path.join(__dirname, '..', 'uploads')));

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiter: 100 requests per minute per IP
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'),
});

// Stricter limiter for credential-guessing-prone endpoints (login, password reset).
// Relaxed under NODE_ENV=test so E2E suites can log in repeatedly without tripping it.
const authRateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('RATE_LIMIT_EXCEEDED', 'Too many attempts, please try again later'),
};

// Login counts failed attempts only: a school's staff and parents often share
// one IP, and counting successful logins locked them all out after 10
// sign-ins. (Password reset can't do the same — it answers success for every
// email, so it would never count anything.)
const loginRateLimiter = rateLimit({ ...authRateLimitOptions, skipSuccessfulRequests: true });
const passwordResetRateLimiter = rateLimit(authRateLimitOptions);

// Global middleware stack for /api routes (applied in order)
app.use('/api/auth/login', loginRateLimiter);
app.use('/api/auth/password-reset', passwordResetRateLimiter);
app.use('/api', rateLimiter);
app.use('/api', authMiddleware);
app.use('/api', tenancyMiddleware);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json(errorResponse('NOT_FOUND', 'The requested resource was not found'));
});

// Global error handler (uploads too large, duplicates, bad JSON... get a proper answer)
app.use(errorHandler);

export default app;
