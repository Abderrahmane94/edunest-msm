import { Request, Response, NextFunction } from 'express';
import { billingService, BillingError } from './billing.service';
import { successResponse, errorResponse } from '../../utils/response';

function handleError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof BillingError) {
    res.status(error.statusCode).json(errorResponse('BILLING_ERROR', error.message));
    return;
  }
  next(error);
}

export const billingController = {
  // Plans
  async listPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await billingService.listPlans();
      res.json(successResponse(plans));
    } catch (e) { handleError(e, res, next); }
  },

  async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await billingService.createPlan(req.body);
      res.status(201).json(successResponse(plan));
    } catch (e) { handleError(e, res, next); }
  },

  async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await billingService.updatePlan(req.params.id, req.body);
      res.json(successResponse(plan));
    } catch (e) { handleError(e, res, next); }
  },

  async deletePlan(req: Request, res: Response, next: NextFunction) {
    try {
      await billingService.deletePlan(req.params.id);
      res.json(successResponse({ message: 'Plan deleted' }));
    } catch (e) { handleError(e, res, next); }
  },

  // Subscriptions
  async listSubscriptions(_req: Request, res: Response, next: NextFunction) {
    try {
      const subs = await billingService.listSubscriptions();
      res.json(successResponse(subs));
    } catch (e) { handleError(e, res, next); }
  },

  async assignPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const sub = await billingService.assignPlan(req.body);
      res.status(201).json(successResponse(sub));
    } catch (e) { handleError(e, res, next); }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const sub = await billingService.updateStatus(req.params.id, req.body.status);
      res.json(successResponse(sub));
    } catch (e) { handleError(e, res, next); }
  },

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await billingService.recordPayment(req.params.id, {
        ...req.body,
        recordedBy: req.user!.userId,
      });
      res.status(201).json(successResponse(payment));
    } catch (e) { handleError(e, res, next); }
  },

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const payments = await billingService.getPayments(req.params.id);
      res.json(successResponse(payments));
    } catch (e) { handleError(e, res, next); }
  },

  // Stats
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await billingService.getStats();
      res.json(successResponse(stats));
    } catch (e) { handleError(e, res, next); }
  },
};
