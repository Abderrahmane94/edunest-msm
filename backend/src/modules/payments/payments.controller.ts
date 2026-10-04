import { Request, Response, NextFunction } from 'express';
import { paymentService, PaymentServiceError } from './payments.service';
import { reconciliationService, ReconciliationServiceError } from './reconciliation.service';
import { receiptService } from './receipt.service';
import { emailService } from '../../services/email.service';
import { recordPaymentSchema, recordCorrectionSchema } from './payments.schema';
import { successResponse, errorResponse } from '../../utils/response';
import { validateBranchAccess, resolveBranchFilter } from './tenant-scope.middleware';
import { derivePeriodStatus } from './billing-period.service';
import prisma from '../../lib/prisma';
import { Prisma, PaymentChannel } from '@prisma/client';
import { z, ZodError } from 'zod';

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

      const filters: Parameters<typeof paymentService.listRecords>[1] = {};

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
      if (typeof req.query.childId === 'string' && req.query.childId) {
        filters.childId = req.query.childId;
      }
      if (req.query.type === 'payment' || req.query.type === 'correction') {
        filters.type = req.query.type;
      }
      if (typeof req.query.feeId === 'string' && req.query.feeId) {
        filters.feeId = req.query.feeId;
      }
      if (typeof req.query.receipt === 'string' && req.query.receipt.trim()) {
        filters.receipt = req.query.receipt.trim().slice(0, 50);
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
          branchFee: {
            select: {
              name: true,
              billingCycle: true,
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
          // Before discounts: lets the payment dialog show what a discount took off.
          baseAmount: period.baseAmount,
          isRegistrationPeriod: period.isRegistrationPeriod,
          branchFeeId: period.branchFeeId,
          branchFeeName: period.branchFee?.name ?? null,
          branchFeeBillingCycle: period.branchFee?.billingCycle ?? null,
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
      const record = await resolveReceiptAccess(req, res);
      if (!record) return;

      // The formatted, localized receipt the receipt dialog renders, plus who
      // "send by email" would go to.
      const language = req.query.language === 'ar' ? 'ar' : 'fr';
      const receipt = await receiptService.generateReceipt(record.id, language);
      const emailRecipient = await defaultReceiptRecipient(req, record.childId);

      res.status(200).json(
        successResponse({ ...receipt, emailRecipient, canChooseRecipient: isStaffUser(req) }),
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/payments/records/:id/receipt/email
   * Emails the receipt. Staff may pick the address (default: the child's
   * primary parent); a parent always receives it at their own address.
   */
  async emailReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await resolveReceiptAccess(req, res);
      if (!record) return;

      const parsed = emailReceiptSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid email address', mapZodErrors(parsed.error)));
        return;
      }

      const recipient = isStaffUser(req)
        ? parsed.data.to || (await defaultReceiptRecipient(req, record.childId))
        : await defaultReceiptRecipient(req, record.childId);

      if (!recipient) {
        res.status(400).json(errorResponse('NO_RECIPIENT', 'No email address to send the receipt to'));
        return;
      }

      // Only attach what really is a PDF.
      let pdf: { filename: string; content: string } | undefined;
      if (parsed.data.pdfBase64) {
        if (!Buffer.from(parsed.data.pdfBase64.slice(0, 16), 'base64').toString('latin1').startsWith('%PDF-')) {
          res.status(400).json(errorResponse('VALIDATION_ERROR', 'The attachment is not a PDF'));
          return;
        }
        pdf = { filename: '', content: parsed.data.pdfBase64 };
      }

      const receipt = await receiptService.generateReceipt(record.id, parsed.data.language ?? 'fr');
      if (pdf) pdf.filename = safePdfFileName(parsed.data.pdfFileName, receipt.receiptNumber);
      try {
        await emailService.sendReceiptEmail(recipient, receipt, pdf);
      } catch (err) {
        res.status(502).json(
          errorResponse('EMAIL_FAILED', err instanceof Error ? err.message : 'Failed to send email'),
        );
        return;
      }

      res.status(200).json(successResponse({ sentTo: recipient }));
    } catch (error) {
      next(error);
    }
  },
};

const emailReceiptSchema = z.object({
  to: z.string().trim().email().optional().or(z.literal('')),
  language: z.enum(['ar', 'fr']).optional(),
  // Receipt PDF rendered by the browser, base64 (~3 MB max once decoded).
  pdfBase64: z.string().max(4_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(),
  pdfFileName: z.string().max(150).optional(),
});

/** Keeps a client-supplied file name safe to attach: no path characters, ends in .pdf. */
function safePdfFileName(name: string | undefined, fallback: string): string {
  // Control characters are stripped on purpose.
  // eslint-disable-next-line no-control-regex
  const base = (name || fallback).replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim();
  return `${base || fallback}.pdf`;
}

function isStaffUser(req: Request): boolean {
  return !!req.user && STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number]);
}

/**
 * Loads a payment record for receipt access: staff within their branch scope,
 * or a parent of the record's child. Sends the error response and returns
 * null when access is denied.
 */
async function resolveReceiptAccess(
  req: Request,
  res: Response,
): Promise<{ id: string; branchId: string; childId: string } | null> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Payment record id path parameter is required'));
    return null;
  }

  const isStaff = isStaffUser(req);
  const isParent = req.user?.role === 'parent';
  if (!isStaff && !isParent) {
    res.status(403).json(errorResponse('FORBIDDEN', 'This operation is restricted to Staff or Parent users'));
    return null;
  }

  const paymentRecord = await prisma.paymentRecord.findUnique({
    where: { id },
    select: { id: true, branchId: true, childId: true },
  });
  if (!paymentRecord) {
    res.status(404).json(errorResponse('NOT_FOUND', 'Payment record not found'));
    return null;
  }

  if (isStaff) {
    const validatedBranch = await validateBranchAccess(paymentRecord.branchId, req, res);
    if (!validatedBranch) return null;
  } else {
    const link = await prisma.parentChildLink.findFirst({
      where: { parentUserId: req.user!.userId, childId: paymentRecord.childId },
      select: { id: true },
    });
    if (!link) {
      res.status(403).json(
        errorResponse('FORBIDDEN', "Access denied. You are not authorized to access this child's data."),
      );
      return null;
    }
  }

  return paymentRecord;
}

/** A parent gets receipts at their own address; staff default to the child's primary parent. */
async function defaultReceiptRecipient(req: Request, childId: string): Promise<string | null> {
  if (!isStaffUser(req)) {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { email: true } });
    return user?.email ?? null;
  }
  const link = await prisma.parentChildLink.findFirst({
    where: { childId },
    orderBy: { isPrimary: 'desc' },
    select: { parent: { select: { email: true } } },
  });
  return link?.parent.email ?? null;
}

/**
 * Map Zod validation errors to the standard FieldError[] format.
 */
function mapZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}
