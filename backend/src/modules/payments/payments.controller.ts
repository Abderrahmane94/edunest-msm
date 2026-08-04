import { Request, Response, NextFunction } from 'express';
import { paymentService, PaymentServiceError } from './payments.service';
import { reconciliationService, ReconciliationServiceError } from './reconciliation.service';
import { recordPaymentSchema, recordCorrectionSchema } from './payments.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchAccess, resolveBranchFilter } from './tenant-scope.middleware';
import { derivePeriodStatus } from './billing-period.service';
import prisma from '../../lib/prisma';
import { Prisma, PaymentChannel } from '@prisma/client';
import { ZodError } from 'zod';

/** Roles considered "Staff" for payment access. */
const STAFF_ROLES = ['admin', 'super_admin'] as const;

export const paymentsController = {
  /**
   * POST /api/payments/records
   * Record a new payment with allocations.
   */
  async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      // Validate request body
      const parsed = recordPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = mapZodErrors(parsed.error);
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }

      const branchId = req.query.branchId as string;
      if (!branchId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'branchId query parameter is required'),
        );
        return;
      }

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      const input = {
        ...parsed.data,
        totalAmount: new Prisma.Decimal(parsed.data.totalAmount.toString()),
        recordedBy: req.user.userId,
        isCorrection: false as const,
        allocations: parsed.data.allocations.map((a) => ({
          billingPeriodId: a.billingPeriodId,
          amount: new Prisma.Decimal(a.amount.toString()),
        })),
      };

      const result = await paymentService.recordPayment(input, validatedBranch);
      res.status(201).json(successResponse(result));
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/payments/records/correction
   * Record a correction (negative payment) against a previous payment.
   */
  async recordCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      // Validate request body
      const parsed = recordCorrectionSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = mapZodErrors(parsed.error);
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Request body validation failed', details),
        );
        return;
      }

      const branchId = req.query.branchId as string;
      if (!branchId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'branchId query parameter is required'),
        );
        return;
      }

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      const input = {
        ...parsed.data,
        totalAmount: new Prisma.Decimal(parsed.data.totalAmount.toString()),
        recordedBy: req.user.userId,
        isCorrection: true as const,
        allocations: parsed.data.allocations.map((a) => ({
          billingPeriodId: a.billingPeriodId,
          amount: new Prisma.Decimal(a.amount.toString()),
        })),
      };

      const result = await paymentService.recordCorrection(input, validatedBranch);
      res.status(201).json(successResponse(result));
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/records
   * List payment records for a branch with optional date range and channel filters.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const requestedBranchId = req.query.branchId as string | undefined;

      // Resolve branch filter based on tenant scope (Req 20.2, 20.3)
      const branchFilter = await resolveBranchFilter(requestedBranchId, req, res);
      if (!branchFilter) return;

      if (!branchFilter.branchId && !branchFilter.branchIds) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'branchId query parameter is required'),
        );
        return;
      }

      const effectiveBranchId = branchFilter.branchId;
      if (!effectiveBranchId) {
        // School-wide staff without explicit branchId: return empty list (Req 20.3)
        res.status(200).json(successResponse([]));
        return;
      }

      const filters: {
        startDate?: Date;
        endDate?: Date;
        channel?: string;
      } = {};

      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.channel) {
        const channel = req.query.channel as string;
        const validChannels: PaymentChannel[] = ['cash', 'ccp', 'baridimob'];
        if (!validChannels.includes(channel as PaymentChannel)) {
          res.status(400).json(
            errorResponse('VALIDATION_ERROR', `Invalid channel. Must be one of: ${validChannels.join(', ')}`),
          );
          return;
        }
        filters.channel = channel;
      }

      const records = await paymentService.listRecords(effectiveBranchId, filters);
      res.status(200).json(successResponse(records));
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/branches/:branchId/late
   * Late payments dashboard for a branch.
   * Optional query param: status ('late' or 'late_partial')
   */
  async getLateDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access (Req 14.5, 14.7)
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const branchId = req.params.branchId;
      if (!branchId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'branchId path parameter is required'),
        );
        return;
      }

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      // Optional status filter validation (Req 14.6)
      let statusFilter: 'late' | 'late_partial' | undefined;
      if (req.query.status) {
        const status = req.query.status as string;
        const validStatuses = ['late', 'late_partial'];
        if (!validStatuses.includes(status)) {
          res.status(400).json(
            errorResponse(
              'VALIDATION_ERROR',
              `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`,
              [{ field: 'status', message: `Must be one of: ${validStatuses.join(', ')}` }],
            ),
          );
          return;
        }
        statusFilter = status as 'late' | 'late_partial';
      }

      const entries = await paymentService.getLateDashboard(validatedBranch, statusFilter);
      res.status(200).json(successResponse(entries));
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/branches/:branchId/reconciliation
   * Generate a reconciliation report for the specified branch and date range.
   * Query params: startDate (required), endDate (required)
   */
  async getReconciliationReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId } = req.params;

      // Validate branch access (Req 20.1, 20.4, 20.6)
      const validatedBranch = await validateBranchAccess(branchId, req, res);
      if (!validatedBranch) return;

      // Validate required query params
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;

      if (!startDateStr || !endDateStr) {
        res.status(400).json(
          errorResponse(
            'VALIDATION_ERROR',
            'Both startDate and endDate query parameters are required',
          ),
        );
        return;
      }

      const rangeStart = new Date(startDateStr);
      const rangeEnd = new Date(endDateStr);

      // Validate dates are valid
      if (isNaN(rangeStart.getTime())) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'startDate is not a valid date'),
        );
        return;
      }
      if (isNaN(rangeEnd.getTime())) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'endDate is not a valid date'),
        );
        return;
      }

      const report = await reconciliationService.generateReport(validatedBranch, rangeStart, rangeEnd);
      res.status(200).json(successResponse(report));
    } catch (error) {
      if (error instanceof ReconciliationServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/payments/children/:childId/periods
   * List a child's billing periods with derived payment status.
   * Staff only. Validates child's enrollment belongs to user's tenant scope.
   * Requirements: 8.10, 8.15
   */
  async getChildPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { childId } = req.params;
      if (!childId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'childId path parameter is required'),
        );
        return;
      }

      // Validate child exists and has enrollments in user's scope
      const child = await prisma.child.findUnique({
        where: { id: childId },
        select: { id: true },
      });

      if (!child) {
        res.status(404).json(
          errorResponse('NOT_FOUND', 'Child not found'),
        );
        return;
      }

      // Get all billing periods for the child with allocations for status derivation
      const periods = await prisma.billingPeriod.findMany({
        where: {
          enrollment: {
            childId,
          },
        },
        include: {
          enrollment: {
            select: {
              id: true,
              branchId: true,
            },
          },
          paymentAllocations: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: [
          { periodStart: 'asc' },
        ],
      });

      // Derive status for each period
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const result = periods.map((period) => {
        const totalPaid = period.paymentAllocations.reduce(
          (sum, alloc) => sum.add(alloc.amount),
          new Prisma.Decimal('0'),
        );

        const derived = derivePeriodStatus(
          period.amountDue,
          totalPaid,
          period.graceEndDate,
          currentDate,
          period.cancelledAt,
        );

        return {
          id: period.id,
          enrollmentId: period.enrollmentId,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          dueDate: period.dueDate,
          graceEndDate: period.graceEndDate,
          amountDue: period.amountDue,
          isRegistrationPeriod: period.isRegistrationPeriod,
          cancelledAt: period.cancelledAt,
          status: derived.status,
          isLate: derived.isLate,
          totalPaid: derived.totalPaid,
          outstanding: derived.outstanding,
        };
      });

      res.status(200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/payments/children/:childId/balance
   * Get a child's outstanding balance.
   * Staff only.
   * Requirements: 13.1
   */
  async getChildBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { childId } = req.params;
      if (!childId) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'childId path parameter is required'),
        );
        return;
      }

      const balance = await paymentService.getOutstandingBalance(childId);

      res.status(200).json(successResponse({
        childId,
        outstandingBalance: balance,
        currency: 'DZD',
      }));
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/payments/periods/:id/cancel
   * Cancel a billing period by setting cancelledAt to current timestamp.
   * Staff only.
   * Requirements: 18.1, 18.9
   */
  async cancelPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Enforce Staff-only access
      if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff users'),
        );
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Period id path parameter is required'),
        );
        return;
      }

      // Find the billing period
      const period = await prisma.billingPeriod.findUnique({
        where: { id },
        include: {
          enrollment: {
            select: {
              branchId: true,
            },
          },
        },
      });

      if (!period) {
        res.status(404).json(
          errorResponse('NOT_FOUND', 'Billing period not found'),
        );
        return;
      }

      // Validate branch access (tenant scoping)
      const validatedBranch = await validateBranchAccess(period.enrollment.branchId, req, res);
      if (!validatedBranch) return;

      // Check if already cancelled
      if (period.cancelledAt !== null) {
        res.status(409).json(
          errorResponse('CONFLICT', 'Billing period is already cancelled'),
        );
        return;
      }

      // Cancel the period by setting cancelledAt to current timestamp
      const updated = await prisma.billingPeriod.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
        },
      });

      res.status(200).json(successResponse({
        id: updated.id,
        enrollmentId: updated.enrollmentId,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        dueDate: updated.dueDate,
        graceEndDate: updated.graceEndDate,
        amountDue: updated.amountDue,
        isRegistrationPeriod: updated.isRegistrationPeriod,
        cancelledAt: updated.cancelledAt,
      }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/payments/records/:id/receipt
   * Generate a receipt for a payment record.
   * Staff or authorized Parent (parent must own the child associated with the payment).
   * Requirements: 18.1, 18.9
   */
  async getReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'Payment record id path parameter is required'),
        );
        return;
      }

      // Determine access: Staff or Parent
      const isStaff = req.user && STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number]);
      const isParent = req.user && req.user.role === 'parent';

      if (!isStaff && !isParent) {
        res.status(403).json(
          errorResponse('FORBIDDEN', 'This operation is restricted to Staff or Parent users'),
        );
        return;
      }

      // Get the payment record with full details for receipt generation
      const paymentRecord = await prisma.paymentRecord.findUnique({
        where: { id },
        include: {
          allocations: {
            include: {
              billingPeriod: {
                select: {
                  id: true,
                  periodStart: true,
                  periodEnd: true,
                  isRegistrationPeriod: true,
                },
              },
            },
          },
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              school: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!paymentRecord) {
        res.status(404).json(
          errorResponse('NOT_FOUND', 'Payment record not found'),
        );
        return;
      }

      // Authorization check
      if (isStaff) {
        // Staff: validate branch access via tenant scope
        const validatedBranch = await validateBranchAccess(paymentRecord.branchId, req, res);
        if (!validatedBranch) return;
      } else if (isParent) {
        // Parent: resolve their linked children and verify ownership
        const links = await prisma.parentChildLink.findMany({
          where: { parentUserId: req.user!.userId },
          select: { childId: true },
        });
        const linkedChildIds = links.map((l) => l.childId);

        if (!linkedChildIds.includes(paymentRecord.childId)) {
          res.status(403).json(
            errorResponse('FORBIDDEN', "Access denied. You are not authorized to access this child's data."),
          );
          return;
        }
      }

      // Build receipt response
      const receipt = {
        receiptNumber: paymentRecord.receiptNumber,
        paymentRecordId: paymentRecord.id,
        school: {
          id: paymentRecord.branch.school.id,
          name: paymentRecord.branch.school.name,
        },
        branch: {
          id: paymentRecord.branch.id,
          name: paymentRecord.branch.name,
        },
        child: {
          id: paymentRecord.child.id,
          name: `${paymentRecord.child.firstName} ${paymentRecord.child.lastName}`,
        },
        totalAmount: paymentRecord.totalAmount,
        currency: 'DZD',
        channel: paymentRecord.channel,
        valueDate: paymentRecord.valueDate,
        isCorrection: paymentRecord.isCorrection,
        referenceNote: paymentRecord.referenceNote,
        allocations: paymentRecord.allocations.map((alloc) => ({
          billingPeriodId: alloc.billingPeriod.id,
          periodStart: alloc.billingPeriod.periodStart,
          periodEnd: alloc.billingPeriod.periodEnd,
          isRegistrationPeriod: alloc.billingPeriod.isRegistrationPeriod,
          amount: alloc.amount,
        })),
        recordedAt: paymentRecord.createdAt,
      };

      res.status(200).json(successResponse(receipt));
    } catch (error) {
      next(error);
    }
  },
};

/**
 * Map Zod validation errors to the standard FieldError[] format.
 */
function mapZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
