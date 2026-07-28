import prisma from '../../lib/prisma';
import type { CreateFeeStructureInput, UpdateFeeStructureInput } from './finance.schema';
import type { CreateInvoiceInput, BulkGenerateInvoicesInput, RecordCashPaymentInput, CreateDiscountInput, UpdateDiscountInput, CreateExpenseInput, UpdateExpenseInput } from './finance.schema';
import type { FeeStructureResponse, InvoiceResponse, CashPaymentResponse, PaymentMethodBreakdown, DiscountResponse, ExpenseResponse, PaymentAuditLogResponse, MonthlyReportResponse, FinancialSummaryResponse } from './finance.types';
import { Prisma } from '@prisma/client';
import { notificationService } from '../../services/notification.service';
import { chargilyGateway } from '../../services/chargily.gateway';
import { cloudinaryService } from '../../services/cloudinary.service';

export class FinanceServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'FinanceServiceError';
  }
}

class FinanceService {
  /**
   * Create a new fee structure for a school.
   */
  async createFeeStructure(
    schoolId: string,
    input: CreateFeeStructureInput,
  ): Promise<FeeStructureResponse> {
    // Verify the academic year belongs to this school
    const academicYear = await prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
    });

    if (!academicYear) {
      throw new FinanceServiceError('Academic year not found', 404);
    }

    const feeStructure = await prisma.feeStructure.create({
      data: {
        schoolId,
        academicYearId: input.academicYearId,
        name: input.name,
        amount: input.amount,
        currency: input.currency ?? 'DZD',
        frequency: input.frequency,
        level: input.level ?? null,
        description: input.description ?? null,
      },
    });

    return feeStructure;
  }

  /**
   * List all fee structures for a school with pagination.
   */
  async listFeeStructures(
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ feeStructures: FeeStructureResponse[]; total: number }> {
    const [feeStructures, total] = await Promise.all([
      prisma.feeStructure.findMany({
        where: { schoolId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feeStructure.count({ where: { schoolId } }),
    ]);

    return { feeStructures, total };
  }

  /**
   * Get a single fee structure by ID, scoped to the school.
   */
  async getFeeStructureById(id: string, schoolId: string): Promise<FeeStructureResponse> {
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
    });

    if (!feeStructure) {
      throw new FinanceServiceError('Fee structure not found', 404);
    }

    return feeStructure;
  }

  /**
   * Update a fee structure. Only allowed when no associated invoices exist.
   */
  async updateFeeStructure(
    id: string,
    schoolId: string,
    input: UpdateFeeStructureInput,
  ): Promise<FeeStructureResponse> {
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
    });

    if (!feeStructure) {
      throw new FinanceServiceError('Fee structure not found', 404);
    }

    // Check if any invoices are associated with this fee structure
    const invoiceCount = await prisma.invoice.count({
      where: { feeStructureId: id },
    });

    if (invoiceCount > 0) {
      throw new FinanceServiceError(
        'Cannot update fee structure with associated invoices',
        409,
      );
    }

    const updated = await prisma.feeStructure.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.frequency !== undefined && { frequency: input.frequency }),
        ...(input.level !== undefined && { level: input.level }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    return updated;
  }

  /**
   * Delete a fee structure. Only allowed when no associated invoices exist.
   */
  async deleteFeeStructure(id: string, schoolId: string): Promise<void> {
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
    });

    if (!feeStructure) {
      throw new FinanceServiceError('Fee structure not found', 404);
    }

    // Check if any invoices are associated with this fee structure
    const invoiceCount = await prisma.invoice.count({
      where: { feeStructureId: id },
    });

    if (invoiceCount > 0) {
      throw new FinanceServiceError(
        'Cannot delete fee structure with associated invoices',
        409,
      );
    }

    await prisma.feeStructure.delete({
      where: { id },
    });
  }

  // ─── Invoice Methods ─────────────────────────────────────────────────────────

  /**
   * Calculate the total discount amount for a child based on active discounts.
   * Active discounts: validFrom <= today AND (validTo is null OR validTo >= today)
   */
  private async calculateDiscountAmount(childId: string, amount: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeDiscounts = await prisma.discount.findMany({
      where: {
        childId,
        validFrom: { lte: today },
        OR: [
          { validTo: null },
          { validTo: { gte: today } },
        ],
      },
    });

    if (activeDiscounts.length === 0) {
      return 0;
    }

    // Sum all applicable discount percentages and apply to amount
    const totalPercentage = activeDiscounts.reduce(
      (sum, discount) => sum + Number(discount.percentage),
      0,
    );

    // Cap at 100% to avoid negative amounts
    const cappedPercentage = Math.min(totalPercentage, 100);
    const discountAmount = (amount * cappedPercentage) / 100;

    // Round to 2 decimal places
    return Math.round(discountAmount * 100) / 100;
  }

  /**
   * Create a single invoice for a child.
   * Auto-applies active discounts and calculates final_amount.
   */
  async createInvoice(
    schoolId: string,
    input: CreateInvoiceInput,
  ): Promise<InvoiceResponse> {
    // Verify child belongs to this school
    const child = await prisma.child.findFirst({
      where: { id: input.childId, schoolId },
    });

    if (!child) {
      throw new FinanceServiceError('Child not found', 404);
    }

    // Verify parent user belongs to this school
    const parent = await prisma.user.findFirst({
      where: { id: input.parentUserId, schoolId, role: 'parent' },
    });

    if (!parent) {
      throw new FinanceServiceError('Parent user not found', 404);
    }

    // Verify fee structure belongs to this school
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id: input.feeStructureId, schoolId },
    });

    if (!feeStructure) {
      throw new FinanceServiceError('Fee structure not found', 404);
    }

    // Calculate discount
    const discountAmount = await this.calculateDiscountAmount(input.childId, input.amount);
    const finalAmount = input.amount - discountAmount;

    const invoice = await prisma.invoice.create({
      data: {
        schoolId,
        childId: input.childId,
        parentUserId: input.parentUserId,
        feeStructureId: input.feeStructureId,
        amount: input.amount,
        discountAmount,
        finalAmount,
        remainingAmount: finalAmount,
        currency: 'DZD',
        dueDate: new Date(input.dueDate),
        status: 'draft',
      },
    });

    return invoice;
  }

  /**
   * Bulk generate invoices for all enrolled children in a classroom.
   * Creates one invoice per enrolled child, auto-applying discounts.
   */
  async bulkGenerateInvoices(
    schoolId: string,
    input: BulkGenerateInvoicesInput,
  ): Promise<InvoiceResponse[]> {
    // Verify classroom belongs to this school
    const classroom = await prisma.classroom.findFirst({
      where: { id: input.classroomId, schoolId },
    });

    if (!classroom) {
      throw new FinanceServiceError('Classroom not found', 404);
    }

    // Verify fee structure belongs to this school
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id: input.feeStructureId, schoolId },
    });

    if (!feeStructure) {
      throw new FinanceServiceError('Fee structure not found', 404);
    }

    // Get all enrolled children in the classroom with their primary parent
    const enrollments = await prisma.classroomEnrollment.findMany({
      where: { classroomId: input.classroomId },
      include: {
        child: {
          include: {
            parentLinks: {
              where: { isPrimary: true },
              select: { parentUserId: true },
            },
          },
        },
      },
    });

    if (enrollments.length === 0) {
      throw new FinanceServiceError('No enrolled children found in this classroom', 400);
    }

    const invoices: InvoiceResponse[] = [];

    for (const enrollment of enrollments) {
      const child = enrollment.child;

      // Skip children without a primary parent link
      if (child.parentLinks.length === 0) {
        continue;
      }

      const parentUserId = child.parentLinks[0].parentUserId;

      // Calculate discount for this child
      const discountAmount = await this.calculateDiscountAmount(child.id, input.amount);
      const finalAmount = input.amount - discountAmount;

      const invoice = await prisma.invoice.create({
        data: {
          schoolId,
          childId: child.id,
          parentUserId,
          feeStructureId: input.feeStructureId,
          amount: input.amount,
          discountAmount,
          finalAmount,
          remainingAmount: finalAmount,
          currency: 'DZD',
          dueDate: new Date(input.dueDate),
          status: 'draft',
        },
      });

      invoices.push(invoice);
    }

    return invoices;
  }

  /**
   * List invoices for a school with pagination.
   */
  async listInvoices(
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ invoices: InvoiceResponse[]; total: number }> {
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { schoolId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where: { schoolId } }),
    ]);

    return { invoices, total };
  }

  /**
   * Get a single invoice by ID.
   * Scoped to school, with optional parent access check.
   */
  async getInvoiceById(
    id: string,
    schoolId: string,
    userId?: string,
    userRole?: string,
  ): Promise<InvoiceResponse> {
    const invoice = await prisma.invoice.findFirst({
      where: { id, schoolId },
    });

    if (!invoice) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    // If the user is a parent, they can only view their own invoices
    if (userRole === 'parent' && invoice.parentUserId !== userId) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    return invoice;
  }

  /**
   * Send an invoice: update status to "sent", set issuedAt, create Chargily checkout, and notify parent.
   */
  async sendInvoice(id: string, schoolId: string, performedByUserId?: string): Promise<InvoiceResponse> {
    const invoice = await prisma.invoice.findFirst({
      where: { id, schoolId },
    });

    if (!invoice) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    if (invoice.status !== 'draft') {
      throw new FinanceServiceError(
        `Cannot send invoice with status "${invoice.status}". Only draft invoices can be sent.`,
        400,
      );
    }

    // Fetch parent's preferred language for checkout locale
    const parent = await prisma.user.findUnique({
      where: { id: invoice.parentUserId },
      select: { preferredLanguage: true },
    });

    const locale = (parent?.preferredLanguage === 'ar' ? 'ar' : 'fr') as 'ar' | 'fr';
    const appUrl = process.env.APP_URL || 'http://localhost:5173';

    // Create Chargily checkout session
    const checkout = await chargilyGateway.createCheckout({
      amount: Number(invoice.finalAmount),
      currency: 'dzd',
      successUrl: `${appUrl}/payments/success?invoice_id=${id}`,
      failureUrl: `${appUrl}/payments/failure?invoice_id=${id}`,
      webhookUrl: `${appUrl}/api/finance/webhooks/chargily`,
      metadata: { invoice_id: id, school_id: schoolId },
      locale,
    });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'sent',
        issuedAt: new Date(),
        chargilyCheckoutId: checkout.id,
        chargilyPaymentUrl: checkout.checkoutUrl,
      },
    });

    // Create audit log entry for draft → sent transition
    await prisma.paymentAuditLog.create({
      data: {
        invoiceId: id,
        action: 'invoice_sent',
        performedBy: performedByUserId || invoice.parentUserId,
        previousStatus: 'draft',
        newStatus: 'sent',
        metadata: {
          chargilyCheckoutId: checkout.id,
        },
      },
    });

    // Notify parent about the invoice with payment URL
    await notificationService.notify({
      userId: invoice.parentUserId,
      title: 'New Invoice',
      body: `You have a new invoice of ${Number(invoice.finalAmount)} ${invoice.currency} due on ${invoice.dueDate.toISOString().split('T')[0]}.`,
      type: 'invoice_sent',
      referenceId: id,
      referenceType: 'invoice',
      channels: ['push', 'email'],
    });

    return updated;
  }

  /**
   * Cancel an invoice: update status to "cancelled".
   * Only draft or sent invoices can be cancelled.
   */
  async cancelInvoice(id: string, schoolId: string, performedByUserId?: string): Promise<InvoiceResponse> {
    const invoice = await prisma.invoice.findFirst({
      where: { id, schoolId },
    });

    if (!invoice) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    if (!['draft', 'sent'].includes(invoice.status)) {
      throw new FinanceServiceError(
        `Cannot cancel invoice with status "${invoice.status}". Only draft or sent invoices can be cancelled.`,
        400,
      );
    }

    const previousStatus = invoice.status;

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    });

    // Create audit log entry for any → cancelled transition
    await prisma.paymentAuditLog.create({
      data: {
        invoiceId: id,
        action: 'invoice_cancelled',
        performedBy: performedByUserId || invoice.parentUserId,
        previousStatus,
        newStatus: 'cancelled',
        metadata: undefined,
      },
    });

    return updated;
  }

  // ─── Chargily Payment Processing ──────────────────────────────────────────────

  /**
   * Process a confirmed Chargily payment.
   * Updates invoice status to "paid", records paid_at, sets paymentMethod to "online",
   * creates an audit log entry, and sends notifications to parent and admin.
   */
  async processChargilyPayment(invoiceId: string, checkoutId: string): Promise<void> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId },
    });

    if (!invoice) {
      console.warn(`[FinanceService] Invoice ${invoiceId} not found for Chargily payment`);
      throw new FinanceServiceError('Invoice not found', 404);
    }

    // Only process if invoice is in a payable state
    if (!['sent', 'overdue'].includes(invoice.status)) {
      console.warn(`[FinanceService] Invoice ${invoiceId} has status "${invoice.status}", skipping payment processing`);
      return;
    }

    const previousStatus = invoice.status;

    // Update invoice to paid
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paymentMethod: 'online',
        paidAt: new Date(),
        remainingAmount: 0,
        chargilyCheckoutId: checkoutId,
      },
    });

    // Create audit log entry
    await prisma.paymentAuditLog.create({
      data: {
        invoiceId,
        action: 'payment_confirmed',
        performedBy: invoice.parentUserId,
        previousStatus,
        newStatus: 'paid',
        metadata: {
          source: 'chargily_webhook',
          checkoutId,
          paymentMethod: 'online',
        },
      },
    });

    // Send payment confirmation to parent
    await notificationService.notify({
      userId: invoice.parentUserId,
      title: 'Payment Confirmed',
      body: `Your payment of ${Number(invoice.finalAmount)} ${invoice.currency} has been confirmed. Thank you!`,
      type: 'payment_received',
      referenceId: invoiceId,
      referenceType: 'invoice',
      channels: ['push', 'email'],
    });

    // Send payment confirmation to school admin(s)
    const admins = await prisma.user.findMany({
      where: { schoolId: invoice.schoolId, role: 'admin', isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await notificationService.notify({
        userId: admin.id,
        title: 'Payment Received',
        body: `Online payment of ${Number(invoice.finalAmount)} ${invoice.currency} received for invoice ${invoiceId}.`,
        type: 'payment_received',
        referenceId: invoiceId,
        referenceType: 'invoice',
        channels: ['push'],
      });
    }
  }

  // ─── Cash Payment Management ──────────────────────────────────────────────────

  /**
   * Record a cash payment against an invoice.
   * Handles partial and full payments, updates invoice status accordingly,
   * creates audit log, and sends notifications.
   */
  async recordCashPayment(
    invoiceId: string,
    schoolId: string,
    input: RecordCashPaymentInput,
    adminUserId: string,
  ): Promise<CashPaymentResponse> {
    const amountReceived = input.amount_received;

    const { invoice, newStatus, newRemaining, cashPayment } = await prisma.$transaction(async (tx) => {
      // Lock the invoice row for the duration of the transaction so concurrent
      // cash-payment submissions against the same invoice are serialized instead
      // of both reading the same stale remainingAmount.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, schoolId },
      });

      if (!invoice) {
        throw new FinanceServiceError('Invoice not found', 404);
      }

      // Reject if invoice is cancelled or already fully paid
      if (invoice.status === 'cancelled') {
        throw new FinanceServiceError('Cannot record payment on a cancelled invoice', 400);
      }

      if (invoice.status === 'paid') {
        throw new FinanceServiceError('Cannot record payment on a fully paid invoice', 400);
      }

      const previousStatus = invoice.status;
      const currentRemaining = invoice.remainingAmount !== null
        ? Number(invoice.remainingAmount)
        : Number(invoice.finalAmount);

      // Calculate new remaining amount
      const newRemaining = Math.round((currentRemaining - amountReceived) * 100) / 100;

      // Determine new status
      const newStatus: 'paid' | 'partial' = newRemaining <= 0 ? 'paid' : 'partial';

      // Update invoice
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          paymentMethod: 'cash',
          remainingAmount: newRemaining <= 0 ? 0 : newRemaining,
          ...(newStatus === 'paid' && { paidAt: new Date() }),
        },
      });

      // Create CashPayment record
      const cashPayment = await tx.cashPayment.create({
        data: {
          invoiceId,
          schoolId,
          amount: amountReceived,
          receivedBy: adminUserId,
          receivedAt: new Date(input.received_at),
          note: input.note ?? null,
        },
      });

      // Create PaymentAuditLog entry
      await tx.paymentAuditLog.create({
        data: {
          invoiceId,
          action: 'cash_payment_recorded',
          performedBy: adminUserId,
          previousStatus,
          newStatus,
          metadata: {
            amount_received: amountReceived,
            remaining_amount: newRemaining <= 0 ? 0 : newRemaining,
            note: input.note ?? null,
            cash_payment_id: cashPayment.id,
          },
        },
      });

      return { invoice, newStatus, newRemaining, cashPayment };
    });

    // Fetch admin name for notification
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { firstName: true, lastName: true },
    });
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    // Send payment confirmation to parent
    const remainingDisplay = newRemaining <= 0 ? 0 : newRemaining;
    await notificationService.notify({
      userId: invoice.parentUserId,
      title: 'Cash Payment Received',
      body: `A cash payment of ${amountReceived} ${invoice.currency} has been recorded by ${adminName}. Remaining balance: ${remainingDisplay} ${invoice.currency}.`,
      type: 'payment_received',
      referenceId: invoiceId,
      referenceType: 'invoice',
      channels: ['push', 'email'],
    });

    // Send internal confirmation to recording admin
    await notificationService.notify({
      userId: adminUserId,
      title: 'Cash Payment Recorded',
      body: `You recorded a cash payment of ${amountReceived} ${invoice.currency} for invoice ${invoiceId}. New status: ${newStatus}.`,
      type: 'payment_received',
      referenceId: invoiceId,
      referenceType: 'invoice',
      channels: ['push'],
    });

    return cashPayment;
  }

  /**
   * List all cash payments for a specific invoice.
   * Parents can only view payments on their own invoices.
   */
  async listCashPayments(
    invoiceId: string,
    schoolId: string,
    userId?: string,
    userRole?: string,
  ): Promise<CashPaymentResponse[]> {
    // Verify invoice exists and belongs to school
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, schoolId },
    });

    if (!invoice) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    // If parent, verify they own this invoice
    if (userRole === 'parent' && invoice.parentUserId !== userId) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    const cashPayments = await prisma.cashPayment.findMany({
      where: { invoiceId, schoolId },
      orderBy: { receivedAt: 'desc' },
    });

    return cashPayments;
  }

  /**
   * Get a single cash payment receipt (placeholder for PDF generation).
   * Returns the cash payment record data.
   */
  async getCashPaymentReceipt(
    cashPaymentId: string,
    schoolId: string,
    userId?: string,
    userRole?: string,
  ): Promise<CashPaymentResponse & { invoice: InvoiceResponse }> {
    const cashPayment = await prisma.cashPayment.findFirst({
      where: { id: cashPaymentId, schoolId },
      include: { invoice: true },
    });

    if (!cashPayment) {
      throw new FinanceServiceError('Cash payment not found', 404);
    }

    // If parent, verify they own the associated invoice
    if (userRole === 'parent' && cashPayment.invoice.parentUserId !== userId) {
      throw new FinanceServiceError('Cash payment not found', 404);
    }

    return cashPayment;
  }

  /**
   * Get payment method breakdown report (cash vs online).
   * Returns count and total amount for each payment method.
   */
  async getPaymentMethodBreakdown(schoolId: string): Promise<PaymentMethodBreakdown> {
    const [onlinePayments, cashPayments] = await Promise.all([
      prisma.invoice.findMany({
        where: { schoolId, paymentMethod: 'online', status: 'paid' },
        select: { finalAmount: true },
      }),
      prisma.cashPayment.findMany({
        where: { schoolId },
        select: { amount: true },
      }),
    ]);

    const onlineTotal = onlinePayments.reduce(
      (sum, inv) => sum + Number(inv.finalAmount),
      0,
    );

    const cashTotal = cashPayments.reduce(
      (sum, cp) => sum + Number(cp.amount),
      0,
    );

    return {
      online: { count: onlinePayments.length, total: Math.round(onlineTotal * 100) / 100 },
      cash: { count: cashPayments.length, total: Math.round(cashTotal * 100) / 100 },
    };
  }

  // ─── Discount Management ───────────────────────────────────────────────────────

  /**
   * Create a new discount for a child.
   * Validates that the child belongs to the school.
   */
  async createDiscount(
    schoolId: string,
    input: CreateDiscountInput,
  ): Promise<DiscountResponse> {
    // Verify child belongs to this school
    const child = await prisma.child.findFirst({
      where: { id: input.childId, schoolId },
    });

    if (!child) {
      throw new FinanceServiceError('Child not found', 404);
    }

    const discount = await prisma.discount.create({
      data: {
        childId: input.childId,
        schoolId,
        type: input.type,
        percentage: input.percentage,
        description: input.description ?? null,
        validFrom: new Date(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    });

    return discount;
  }

  /**
   * List discounts for a school with optional childId filter and pagination.
   */
  async listDiscounts(
    schoolId: string,
    page: number,
    pageSize: number,
    childId?: string,
  ): Promise<{ discounts: DiscountResponse[]; total: number }> {
    const where: Prisma.DiscountWhereInput = { schoolId };
    if (childId) {
      where.childId = childId;
    }

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.discount.count({ where }),
    ]);

    return { discounts, total };
  }

  /**
   * Get a single discount by ID, scoped to the school.
   */
  async getDiscountById(id: string, schoolId: string): Promise<DiscountResponse> {
    const discount = await prisma.discount.findFirst({
      where: { id, schoolId },
    });

    if (!discount) {
      throw new FinanceServiceError('Discount not found', 404);
    }

    return discount;
  }

  /**
   * Update a discount.
   */
  async updateDiscount(
    id: string,
    schoolId: string,
    input: UpdateDiscountInput,
  ): Promise<DiscountResponse> {
    const discount = await prisma.discount.findFirst({
      where: { id, schoolId },
    });

    if (!discount) {
      throw new FinanceServiceError('Discount not found', 404);
    }

    const updated = await prisma.discount.update({
      where: { id },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.percentage !== undefined && { percentage: input.percentage }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.validFrom !== undefined && { validFrom: new Date(input.validFrom) }),
        ...(input.validTo !== undefined && { validTo: input.validTo ? new Date(input.validTo) : null }),
      },
    });

    return updated;
  }

  /**
   * Delete a discount.
   */
  async deleteDiscount(id: string, schoolId: string): Promise<void> {
    const discount = await prisma.discount.findFirst({
      where: { id, schoolId },
    });

    if (!discount) {
      throw new FinanceServiceError('Discount not found', 404);
    }

    await prisma.discount.delete({
      where: { id },
    });
  }

  // ─── Expense Management ────────────────────────────────────────────────────────

  /**
   * Create a new expense for a school.
   */
  async createExpense(
    schoolId: string,
    input: CreateExpenseInput,
    createdByUserId: string,
  ): Promise<ExpenseResponse> {
    const expense = await prisma.expense.create({
      data: {
        schoolId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        currency: input.currency ?? 'DZD',
        date: new Date(input.date),
        createdByUserId,
      },
    });

    return expense;
  }

  /**
   * List expenses for a school with pagination.
   */
  async listExpenses(
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ expenses: ExpenseResponse[]; total: number }> {
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: { schoolId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      prisma.expense.count({ where: { schoolId } }),
    ]);

    return { expenses, total };
  }

  /**
   * Get a single expense by ID, scoped to the school.
   */
  async getExpenseById(id: string, schoolId: string): Promise<ExpenseResponse> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new FinanceServiceError('Expense not found', 404);
    }

    return expense;
  }

  /**
   * Update an expense.
   */
  async updateExpense(
    id: string,
    schoolId: string,
    input: UpdateExpenseInput,
  ): Promise<ExpenseResponse> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new FinanceServiceError('Expense not found', 404);
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.date !== undefined && { date: new Date(input.date) }),
      },
    });

    return updated;
  }

  /**
   * Delete an expense.
   */
  async deleteExpense(id: string, schoolId: string): Promise<void> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new FinanceServiceError('Expense not found', 404);
    }

    // If there's a receipt, delete it from Cloudinary
    if (expense.receiptPublicId) {
      await cloudinaryService.deleteFile(expense.receiptPublicId);
    }

    await prisma.expense.delete({
      where: { id },
    });
  }

  /**
   * Upload a receipt for an expense.
   * Stores the file in Cloudinary and saves the public_id.
   */
  async uploadExpenseReceipt(
    id: string,
    schoolId: string,
    file: Buffer,
  ): Promise<ExpenseResponse> {
    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
    });

    if (!expense) {
      throw new FinanceServiceError('Expense not found', 404);
    }

    // Delete old receipt if exists
    if (expense.receiptPublicId) {
      await cloudinaryService.deleteFile(expense.receiptPublicId);
    }

    // Upload new receipt
    const uploadResult = await cloudinaryService.uploadFile(file, {
      folder: `schools/${schoolId}/expenses`,
      resourceType: 'raw',
      accessMode: 'authenticated',
    });

    const updated = await prisma.expense.update({
      where: { id },
      data: { receiptPublicId: uploadResult.publicId },
    });

    return updated;
  }

  /**
   * Get a signed URL for an expense receipt (24-hour expiry).
   */
  getExpenseReceiptUrl(id: string, schoolId: string): Promise<string> {
    return prisma.expense.findFirst({
      where: { id, schoolId },
    }).then((expense) => {
      if (!expense) {
        throw new FinanceServiceError('Expense not found', 404);
      }

      if (!expense.receiptPublicId) {
        throw new FinanceServiceError('No receipt uploaded for this expense', 404);
      }

      const signedUrl = cloudinaryService.generateSignedUrl(expense.receiptPublicId, 'document');
      return signedUrl;
    });
  }

  // ─── Payment Audit Log ─────────────────────────────────────────────────────────

  /**
   * Get audit log entries for a specific invoice.
   */
  async getInvoiceAuditLog(
    invoiceId: string,
    schoolId: string,
  ): Promise<PaymentAuditLogResponse[]> {
    // Verify invoice exists and belongs to school
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, schoolId },
    });

    if (!invoice) {
      throw new FinanceServiceError('Invoice not found', 404);
    }

    const auditLogs = await prisma.paymentAuditLog.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });

    return auditLogs;
  }

  // ─── Financial Reporting ───────────────────────────────────────────────────────

  /**
   * Get monthly financial report for a school.
   * Includes total invoiced, collected, outstanding, and expenses for the given month.
   */
  async getMonthlyReport(
    schoolId: string,
    month: number,
    year: number,
  ): Promise<MonthlyReportResponse> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month

    // Get all invoices created in this month
    const invoices = await prisma.invoice.findMany({
      where: {
        schoolId,
        createdAt: { gte: startDate, lte: new Date(endDate.getTime() + 86400000 - 1) },
      },
      select: { finalAmount: true, status: true, paymentMethod: true },
    });

    const totalInvoiced = invoices.reduce(
      (sum, inv) => sum + Number(inv.finalAmount),
      0,
    );

    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    const totalCollected = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.finalAmount),
      0,
    );

    const outstandingInvoices = invoices.filter((inv) =>
      ['sent', 'partial', 'overdue'].includes(inv.status),
    );
    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.finalAmount),
      0,
    );

    // Get expenses for this month
    const expenses = await prisma.expense.findMany({
      where: {
        schoolId,
        date: { gte: startDate, lte: endDate },
      },
      select: { amount: true },
    });

    const totalExpenses = expenses.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0,
    );

    // Payment method breakdown for paid invoices in this month
    const onlinePaid = paidInvoices.filter((inv) => inv.paymentMethod === 'online');
    const cashPaid = paidInvoices.filter((inv) => inv.paymentMethod === 'cash');

    const paymentMethodBreakdown: PaymentMethodBreakdown = {
      online: {
        count: onlinePaid.length,
        total: Math.round(onlinePaid.reduce((sum, inv) => sum + Number(inv.finalAmount), 0) * 100) / 100,
      },
      cash: {
        count: cashPaid.length,
        total: Math.round(cashPaid.reduce((sum, inv) => sum + Number(inv.finalAmount), 0) * 100) / 100,
      },
    };

    return {
      month,
      year,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      paymentMethodBreakdown,
    };
  }

  /**
   * Get financial summary for a school.
   * Includes total revenue, collection rate, expense breakdown by category,
   * and payment method breakdown.
   */
  async getFinancialSummary(schoolId: string): Promise<FinancialSummaryResponse> {
    // Total revenue (all paid invoices)
    const paidInvoices = await prisma.invoice.findMany({
      where: { schoolId, status: 'paid' },
      select: { finalAmount: true, paymentMethod: true },
    });

    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.finalAmount),
      0,
    );

    // Total invoiced (all non-draft invoices)
    const allInvoices = await prisma.invoice.findMany({
      where: { schoolId, status: { not: 'draft' } },
      select: { finalAmount: true },
    });

    const totalInvoiced = allInvoices.reduce(
      (sum, inv) => sum + Number(inv.finalAmount),
      0,
    );

    const collectionRate = totalInvoiced > 0
      ? Math.round((totalRevenue / totalInvoiced) * 10000) / 100
      : 0;

    // Total expenses
    const expenses = await prisma.expense.findMany({
      where: { schoolId },
      select: { amount: true, category: true },
    });

    const totalExpenses = expenses.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0,
    );

    // Expense breakdown by category
    const expenseBreakdownByCategory: Record<string, number> = {};
    for (const exp of expenses) {
      const category = exp.category;
      if (!expenseBreakdownByCategory[category]) {
        expenseBreakdownByCategory[category] = 0;
      }
      expenseBreakdownByCategory[category] += Number(exp.amount);
    }

    // Round category totals
    for (const key of Object.keys(expenseBreakdownByCategory)) {
      expenseBreakdownByCategory[key] = Math.round(expenseBreakdownByCategory[key] * 100) / 100;
    }

    // Payment method breakdown
    const onlinePaid = paidInvoices.filter((inv) => inv.paymentMethod === 'online');
    const cashPaid = paidInvoices.filter((inv) => inv.paymentMethod === 'cash');

    const paymentMethodBreakdown: PaymentMethodBreakdown = {
      online: {
        count: onlinePaid.length,
        total: Math.round(onlinePaid.reduce((sum, inv) => sum + Number(inv.finalAmount), 0) * 100) / 100,
      },
      cash: {
        count: cashPaid.length,
        total: Math.round(cashPaid.reduce((sum, inv) => sum + Number(inv.finalAmount), 0) * 100) / 100,
      },
    };

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      collectionRate,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      expenseBreakdownByCategory,
      paymentMethodBreakdown,
    };
  }
}

export const financeService = new FinanceService();
