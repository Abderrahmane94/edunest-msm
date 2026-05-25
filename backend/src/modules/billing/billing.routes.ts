import { Router } from 'express';
import { billingController } from './billing.controller';
import { requireSuperAdmin } from '../../middleware/rbac.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { idParamSchema } from '../../utils/validators';
import { createPlanSchema, updatePlanSchema, assignPlanSchema, recordPaymentSchema, updateStatusSchema } from './billing.schema';

const router = Router();

// All billing routes are super_admin only
router.use(requireSuperAdmin);

// Plans
router.get('/plans', billingController.listPlans);
router.post('/plans', validate(createPlanSchema), billingController.createPlan);
router.put('/plans/:id', validateParams(idParamSchema), validate(updatePlanSchema), billingController.updatePlan);
router.delete('/plans/:id', validateParams(idParamSchema), billingController.deletePlan);

// Subscriptions
router.get('/subscriptions', billingController.listSubscriptions);
router.post('/subscriptions', validate(assignPlanSchema), billingController.assignPlan);
router.patch('/subscriptions/:id/status', validateParams(idParamSchema), validate(updateStatusSchema), billingController.updateStatus);
router.post('/subscriptions/:id/payments', validateParams(idParamSchema), validate(recordPaymentSchema), billingController.recordPayment);
router.get('/subscriptions/:id/payments', validateParams(idParamSchema), billingController.getPayments);

// Payments
router.get('/payments', billingController.getPaymentsBySchool);

// Stats
router.get('/stats', billingController.getStats);

export default router;
