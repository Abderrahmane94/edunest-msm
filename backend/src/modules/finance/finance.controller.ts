import { Request, Response, NextFunction } from 'express';
import { financeService, FinanceServiceError } from './finance.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateFeeStructureInput, UpdateFeeStructureInput, CreateInvoiceInput, BulkGenerateInvoicesInput, RecordCashPaymentInput, CreateDiscountInput, UpdateDiscountInput, CreateExpenseInput, UpdateExpenseInput } from './finance.schema';
import { monthlyReportQuerySchema } from './finance.schema';
import { paginationSchema } from '../../utils/validators';
import { chargilyGateway } from '../../services/chargily.gateway';

export const financeController = {
  /**
   * POST /api/finance/fee-structures — Create a new fee structure
   */
  async createFeeStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const input = req.body as CreateFeeStructureInput;
      const feeStructure = await financeService.createFeeStructure(schoolId, input);
      res.status(201).json(successResponse(feeStructure));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/fee-structures — List fee structures for the school
   */
  async listFeeStructures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { feeStructures, total } = await financeService.listFeeStructures(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(feeStructures, page, pageSize, total));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/fee-structures/:id — Get fee structure by ID
   */
  async getFeeStructureById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const feeStructure = await financeService.getFeeStructureById(id, schoolId);
      res.status(200).json(successResponse(feeStructure));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/finance/fee-structures/:id — Update fee structure (only if no invoices)
   */
  async updateFeeStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const input = req.body as UpdateFeeStructureInput;
      const feeStructure = await financeService.updateFeeStructure(id, schoolId, input);
      res.status(200).json(successResponse(feeStructure));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/finance/fee-structures/:id — Delete fee structure (only if no invoices)
   */
  async deleteFeeStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      await financeService.deleteFeeStructure(id, schoolId);
      res.status(200).json(successResponse({ message: 'Fee structure deleted successfully' }));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Invoice Handlers ────────────────────────────────────────────────────────

  /**
   * POST /api/finance/invoices — Create a single invoice
   */
  async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const input = req.body as CreateInvoiceInput;
      const invoice = await financeService.createInvoice(schoolId, input);
      res.status(201).json(successResponse(invoice));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/finance/invoices/bulk — Bulk generate invoices for a classroom
   */
  async bulkGenerateInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const input = req.body as BulkGenerateInvoicesInput;
      const invoices = await financeService.bulkGenerateInvoices(schoolId, input);
      res.status(201).json(successResponse(invoices));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/invoices — List invoices for the school
   */
  async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { invoices, total } = await financeService.listInvoices(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(invoices, page, pageSize, total));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/invoices/:id — Get invoice by ID (admin or parent)
   */
  async getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const invoice = await financeService.getInvoiceById(id, schoolId, userId, userRole);
      res.status(200).json(successResponse(invoice));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/finance/invoices/:id/send — Send invoice (status → sent)
   */
  async sendInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { id } = req.params;
      const invoice = await financeService.sendInvoice(id, schoolId, userId);
      res.status(200).json(successResponse(invoice));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/finance/invoices/:id/cancel — Cancel invoice
   */
  async cancelInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { id } = req.params;
      const invoice = await financeService.cancelInvoice(id, schoolId, userId);
      res.status(200).json(successResponse(invoice));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Webhook Handlers ──────────────────────────────────────────────────────

  /**
   * POST /api/finance/webhooks/chargily — Handle Chargily Pay webhook
   * This endpoint is PUBLIC (no auth required).
   * Verifies HMAC-SHA256 signature before processing.
   */
  async handleChargilyWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get the raw body for signature verification
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : JSON.stringify(req.body);
      const signature = req.headers['signature'] as string || '';

      // Verify webhook signature
      if (!chargilyGateway.verifyWebhookSignature(rawBody, signature)) {
        res.status(401).json(errorResponse('WEBHOOK_ERROR', 'Invalid webhook signature'));
        return;
      }

      // Parse the webhook payload
      const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf-8')) : req.body;
      const eventType = payload.type || payload.event;

      // Only process "checkout.paid" events
      if (eventType !== 'checkout.paid') {
        // Acknowledge other events without processing
        res.status(200).json({ received: true });
        return;
      }

      const checkoutData = payload.data || payload;
      const checkoutId = checkoutData.id;
      const metadata = checkoutData.metadata || {};
      const invoiceId = metadata.invoice_id;

      if (!invoiceId) {
        console.warn('[ChargilyWebhook] No invoice_id in webhook metadata:', metadata);
        res.status(400).json(errorResponse('WEBHOOK_ERROR', 'Missing invoice_id in metadata'));
        return;
      }

      // Process the payment confirmation
      await financeService.processChargilyPayment(invoiceId, checkoutId);

      res.status(200).json({ received: true });
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Cash Payment Handlers ─────────────────────────────────────────────────

  /**
   * POST /api/finance/invoices/:id/cash-payment — Record a cash payment (admin only)
   */
  async recordCashPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const adminUserId = req.user!.userId;
      const { id } = req.params;
      const input = req.body as RecordCashPaymentInput;
      const cashPayment = await financeService.recordCashPayment(id, schoolId, input, adminUserId);
      res.status(201).json(successResponse(cashPayment));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/invoices/:id/cash-payments — List cash payments on an invoice
   */
  async listCashPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const cashPayments = await financeService.listCashPayments(id, schoolId, userId, userRole);
      res.status(200).json(successResponse(cashPayments));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/cash-payments/:id/receipt — Get cash payment receipt (placeholder)
   */
  async getCashPaymentReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const receipt = await financeService.getCashPaymentReceipt(id, schoolId, userId, userRole);
      // Placeholder: return JSON data that would be used for PDF generation
      res.status(200).json(successResponse({
        ...receipt,
        _note: 'PDF generation placeholder — integrate a PDF library (e.g., pdfkit) for actual receipt generation',
      }));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/report/payment-methods — Payment method breakdown (admin only)
   */
  async getPaymentMethodBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const breakdown = await financeService.getPaymentMethodBreakdown(schoolId);
      res.status(200).json(successResponse(breakdown));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Discount Handlers ─────────────────────────────────────────────────────

  /**
   * POST /api/finance/discounts — Create a new discount (admin only)
   */
  async createDiscount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const input = req.body as CreateDiscountInput;
      const discount = await financeService.createDiscount(schoolId, input);
      res.status(201).json(successResponse(discount));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/discounts — List discounts for the school (admin only)
   */
  async listDiscounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const childId = req.query.childId as string | undefined;
      const { discounts, total } = await financeService.listDiscounts(schoolId, page, pageSize, childId);
      res.status(200).json(paginatedResponse(discounts, page, pageSize, total));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/discounts/:id — Get discount by ID (admin only)
   */
  async getDiscountById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const discount = await financeService.getDiscountById(id, schoolId);
      res.status(200).json(successResponse(discount));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/finance/discounts/:id — Update discount (admin only)
   */
  async updateDiscount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const input = req.body as UpdateDiscountInput;
      const discount = await financeService.updateDiscount(id, schoolId, input);
      res.status(200).json(successResponse(discount));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/finance/discounts/:id — Delete discount (admin only)
   */
  async deleteDiscount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      await financeService.deleteDiscount(id, schoolId);
      res.status(200).json(successResponse({ message: 'Discount deleted successfully' }));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Expense Handlers ──────────────────────────────────────────────────────

  /**
   * POST /api/finance/expenses — Create a new expense (admin only)
   */
  async createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const input = req.body as CreateExpenseInput;
      const expense = await financeService.createExpense(schoolId, input, userId);
      res.status(201).json(successResponse(expense));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/expenses — List expenses for the school (admin only)
   */
  async listExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { expenses, total } = await financeService.listExpenses(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(expenses, page, pageSize, total));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/expenses/:id — Get expense by ID (admin only)
   */
  async getExpenseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const expense = await financeService.getExpenseById(id, schoolId);
      res.status(200).json(successResponse(expense));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/finance/expenses/:id — Update expense (admin only)
   */
  async updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const input = req.body as UpdateExpenseInput;
      const expense = await financeService.updateExpense(id, schoolId, input);
      res.status(200).json(successResponse(expense));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/finance/expenses/:id — Delete expense (admin only)
   */
  async deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      await financeService.deleteExpense(id, schoolId);
      res.status(200).json(successResponse({ message: 'Expense deleted successfully' }));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/finance/expenses/:id/receipt — Upload receipt for expense (admin only)
   */
  async uploadExpenseReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;

      if (!req.file) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'No file uploaded'));
        return;
      }

      const expense = await financeService.uploadExpenseReceipt(id, schoolId, req.file.buffer);
      res.status(200).json(successResponse(expense));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/expenses/:id/receipt-url — Get signed receipt URL (admin only)
   */
  async getExpenseReceiptUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const url = await financeService.getExpenseReceiptUrl(id, schoolId);
      res.status(200).json(successResponse({ url }));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Audit Log Handlers ────────────────────────────────────────────────────

  /**
   * GET /api/finance/invoices/:id/audit-log — List audit log entries for an invoice (admin only)
   */
  async getInvoiceAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { id } = req.params;
      const auditLogs = await financeService.getInvoiceAuditLog(id, schoolId);
      res.status(200).json(successResponse(auditLogs));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Financial Report Handlers ─────────────────────────────────────────────

  /**
   * GET /api/finance/report/monthly — Monthly financial report (admin only)
   */
  async getMonthlyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const { month, year } = monthlyReportQuerySchema.parse(req.query);
      const report = await financeService.getMonthlyReport(schoolId, month, year);
      res.status(200).json(successResponse(report));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/finance/report/summary — Financial summary (admin only)
   */
  async getFinancialSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const summary = await financeService.getFinancialSummary(schoolId);
      res.status(200).json(successResponse(summary));
    } catch (error) {
      if (error instanceof FinanceServiceError) {
        res.status(error.statusCode).json(errorResponse('FINANCE_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
