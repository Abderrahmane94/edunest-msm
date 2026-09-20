import { Router } from 'express';
import branchConfigRoutes from './branch-config.routes';
import branchCalendarRoutes from './branch-calendar.routes';
import branchFeeRoutes from './branch-fee.routes';
import branchFeePeriodRoutes from './branch-fee-period.routes';
import branchFeeClassroomRoutes from './branch-fee-classroom.routes';
import enrollmentRoutes from './enrollment.routes';
import paymentsRoutes from './payments.routes';
import discountRoutes from './discount.routes';
import expenseRoutes from './expense.routes';
import parentPortalRoutes from './parent-portal.routes';
import { paymentTenancyMiddleware } from './tenant-scope.middleware';

const router = Router();

// Apply payment-specific tenancy middleware to all payment routes
router.use(paymentTenancyMiddleware);

// Branch billing configuration
router.use(branchConfigRoutes);

// Branch calendar period boundaries
router.use(branchCalendarRoutes);

// Branch fee configuration
router.use(branchFeeRoutes);

// Per-fee period assignments (which calendar periods a fee bills against)
router.use(branchFeePeriodRoutes);

// Per-fee classroom links (which classrooms a fee applies to)
router.use(branchFeeClassroomRoutes);

// Enrollment management
router.use(enrollmentRoutes);

// Per-enrollment discounts
router.use(discountRoutes);

// Payment recording, late dashboard, reconciliation
router.use(paymentsRoutes);

// School expense tracking
router.use(expenseRoutes);

// Parent portal (read-only)
router.use('/parent', parentPortalRoutes);

export default router;
