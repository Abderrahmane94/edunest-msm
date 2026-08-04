/**
 * Overdue Invoices Cron Job
 *
 * Runs daily at midnight to:
 * 1. Find all invoices with status "sent" and dueDate before today
 * 2. Update their status to "overdue"
 * 3. Send SMS reminder via Twilio to parent
 * 4. Send email reminder via Resend to parent
 * 5. Create PaymentAuditLog entries for each transition
 */

import prisma from '../lib/prisma';
import { notificationService } from '../services/notification.service';

/**
 * Process overdue invoices.
 * Called by node-cron on a daily schedule.
 */
export async function processOverdueInvoices(): Promise<void> {
  // dueDate is a @db.Date column (stored as UTC midnight), so the comparison
  // must use UTC midnight too — a server-local midnight would shift the
  // overdue boundary by the host's UTC offset.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  console.log(`[OverdueInvoicesJob] Running at ${new Date().toISOString()}`);

  try {
    // Find all sent invoices with due date before today
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'sent',
        dueDate: { lt: today },
      },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            preferredLanguage: true,
          },
        },
      },
    });

    if (overdueInvoices.length === 0) {
      console.log('[OverdueInvoicesJob] No overdue invoices found');
      return;
    }

    console.log(`[OverdueInvoicesJob] Found ${overdueInvoices.length} overdue invoice(s)`);

    for (const invoice of overdueInvoices) {
      try {
        // Compare-and-swap on status so that if another instance of this job
        // (e.g. a second server process) already flipped this invoice to
        // overdue, we don't double-log the transition or double-notify the parent.
        const { count } = await prisma.invoice.updateMany({
          where: { id: invoice.id, status: 'sent' },
          data: { status: 'overdue' },
        });

        if (count === 0) {
          console.log(`[OverdueInvoicesJob] Invoice ${invoice.id} already processed by another run, skipping`);
          continue;
        }

        // Create PaymentAuditLog entry
        await prisma.paymentAuditLog.create({
          data: {
            invoiceId: invoice.id,
            action: 'invoice_overdue',
            performedBy: invoice.parentUserId, // System action, attributed to parent
            previousStatus: 'sent',
            newStatus: 'overdue',
            metadata: {
              source: 'overdue_cron_job',
              dueDate: invoice.dueDate.toISOString(),
              processedAt: new Date().toISOString(),
            },
          },
        });

        // Send SMS + email reminder to parent
        const dueDate = invoice.dueDate.toISOString().split('T')[0];
        const amount = Number(invoice.finalAmount);

        await notificationService.notify({
          userId: invoice.parentUserId,
          title: 'Payment Overdue',
          body: `Your invoice of ${amount} ${invoice.currency} was due on ${dueDate} and is now overdue. Please make payment as soon as possible.`,
          type: 'payment_overdue',
          referenceId: invoice.id,
          referenceType: 'invoice',
          channels: ['push', 'email', 'sms'],
        });

        console.log(`[OverdueInvoicesJob] Processed invoice ${invoice.id} → overdue`);
      } catch (error) {
        console.error(`[OverdueInvoicesJob] Failed to process invoice ${invoice.id}:`, error);
        // Continue processing other invoices
      }
    }

    console.log(`[OverdueInvoicesJob] Completed. Processed ${overdueInvoices.length} invoice(s)`);
  } catch (error) {
    console.error('[OverdueInvoicesJob] Fatal error:', error);
  }
}
