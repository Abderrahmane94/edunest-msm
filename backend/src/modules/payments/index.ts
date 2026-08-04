import { Router } from 'express';
import branchConfigRoutes from './branch-config.routes';
import branchCalendarRoutes from './branch-calendar.routes';
import enrollmentRoutes from './enrollment.routes';
import paymentsRoutes from './payments.routes';
import parentPortalRoutes from './parent-portal.routes';
import { paymentTenancyMiddleware } from './tenant-scope.middleware';

const router = Router();

// Apply payment-specific tenancy middleware to all payment routes
router.use(paymentTenancyMiddleware);

// Branch billing configuration
router.use(branchConfigRoutes);

// Branch calendar period boundaries
router.use(branchCalendarRoutes);

// Enrollment management
router.use(enrollmentRoutes);

// Payment recording, late dashboard, reconciliation
router.use(paymentsRoutes);

// Parent portal (read-only)
router.use('/parent', parentPortalRoutes);

export default router;
