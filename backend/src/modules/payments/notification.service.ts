import prisma from '../../lib/prisma';

/**
 * Notification dispatch failure entry, retrievable by staff.
 */
export interface NotificationFailureEntry {
  id: string;
  branchId: string;
  billingPeriodId?: string;
  paymentRecordId?: string;
  notificationType: 'late' | 'confirmation';
  targetUserId: string;
  errorMessage: string;
  createdAt: Date;
}

/**
 * In-memory deduplication tracker for late notifications.
 * Key format: `${billingPeriodId}:${YYYY-MM-DD}`
 * In production this would be backed by a cache (Redis) or DB table.
 */
const lateNotificationLog = new Map<string, Date>();

/**
 * In-memory store for dispatch failure entries.
 * In production this would be persisted to a dedicated DB table.
 */
const dispatchFailures: NotificationFailureEntry[] = [];

let failureIdCounter = 0;

/**
 * PaymentNotificationService handles optional, non-blocking notifications
 * for the payment management module.
 *
 * Key behaviors:
 * - Checks branch `notificationSetting` before dispatching
 * - Dispatches late notifications on period status transition to late/late_partial
 * - Dispatches payment confirmation on successful payment record insert
 * - Deduplicates: max one late notification per period per day
 * - Records failures for staff retrieval
 * - Never throws to caller — payment recording completes independently
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9
 */
class PaymentNotificationService {
  /**
   * Dispatch a late notification for a billing period that has transitioned
   * to `late` or `late_partial` status.
   *
   * Non-blocking: catches all errors internally.
   * Deduplicates: at most one late notification per period per calendar day.
   *
   * @param branchId - The branch the period belongs to
   * @param billingPeriodId - The billing period that became late
   * @param childId - The child associated with the period
   */
  async dispatchLateNotification(
    branchId: string,
    billingPeriodId: string,
    childId: string,
  ): Promise<void> {
    try {
      // Check branch notification setting
      const isEnabled = await this.isBranchNotificationEnabled(branchId);
      if (!isEnabled) return;

      // Deduplicate: check if we already sent a late notification for this period today
      const today = this.getTodayDateString();
      const deduplicationKey = `${billingPeriodId}:${today}`;
      if (lateNotificationLog.has(deduplicationKey)) {
        return; // Already sent today, skip (Req 21.3)
      }

      // Find all parent users linked to this child
      const parentUserIds = await this.getParentUserIdsForChild(childId);
      if (parentUserIds.length === 0) {
        // No linked parents — request no notification, no failure entry (Req 21.8)
        return;
      }

      // Dispatch notification to each parent
      for (const parentUserId of parentUserIds) {
        await this.sendNotification({
          branchId,
          userId: parentUserId,
          type: 'payment_overdue',
          title: 'Payment Overdue',
          body: `A billing period is now overdue. Please check your payment portal for details.`,
          referenceId: billingPeriodId,
          referenceType: 'billing_period',
        });
      }

      // Mark as sent for deduplication
      lateNotificationLog.set(deduplicationKey, new Date());
    } catch (error) {
      // Record failure but never throw (Req 21.5, 21.6)
      this.recordFailure({
        branchId,
        billingPeriodId,
        notificationType: 'late',
        targetUserId: 'all',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Dispatch a payment confirmation notification after a payment record is inserted.
   *
   * Non-blocking: catches all errors internally.
   * Called for both regular payments and corrections (Req 21.2).
   *
   * @param branchId - The branch the payment belongs to
   * @param paymentRecordId - The inserted payment record ID
   * @param childId - The child the payment is for
   */
  async dispatchPaymentConfirmation(
    branchId: string,
    paymentRecordId: string,
    childId: string,
  ): Promise<void> {
    try {
      // Check branch notification setting
      const isEnabled = await this.isBranchNotificationEnabled(branchId);
      if (!isEnabled) return;

      // Find all parent users linked to this child
      const parentUserIds = await this.getParentUserIdsForChild(childId);
      if (parentUserIds.length === 0) {
        // No linked parents — request no notification, no failure entry (Req 21.8)
        return;
      }

      // Dispatch confirmation to each parent
      for (const parentUserId of parentUserIds) {
        await this.sendNotification({
          branchId,
          userId: parentUserId,
          type: 'payment_received',
          title: 'Payment Confirmation',
          body: `A payment has been recorded for your child. Check the payment portal for details.`,
          referenceId: paymentRecordId,
          referenceType: 'payment_record',
        });
      }
    } catch (error) {
      // Record failure but never throw (Req 21.5, 21.6)
      this.recordFailure({
        branchId,
        paymentRecordId,
        notificationType: 'confirmation',
        targetUserId: 'all',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get dispatch failure entries for a branch, retrievable by staff (Req 21.5).
   */
  getFailuresForBranch(branchId: string): NotificationFailureEntry[] {
    return dispatchFailures.filter((f) => f.branchId === branchId);
  }

  /**
   * Clear all failure entries for a branch.
   */
  clearFailuresForBranch(branchId: string): void {
    const indices: number[] = [];
    for (let i = dispatchFailures.length - 1; i >= 0; i--) {
      if (dispatchFailures[i].branchId === branchId) {
        indices.push(i);
      }
    }
    for (const idx of indices) {
      dispatchFailures.splice(idx, 1);
    }
  }

  // --- Private Helpers ---

  /**
   * Check whether the branch's notification setting is `enabled`.
   * Returns false when setting is `disabled` or config doesn't exist (Req 21.4, 21.7).
   */
  private async isBranchNotificationEnabled(branchId: string): Promise<boolean> {
    const config = await prisma.branchBillingConfig.findUnique({
      where: { branchId },
      select: { notificationSetting: true },
    });
    return config?.notificationSetting === 'enabled';
  }

  /**
   * Resolve parent user IDs linked to a child through parent_child_links.
   * Returns empty array if no parents linked (Req 21.8).
   */
  private async getParentUserIdsForChild(childId: string): Promise<string[]> {
    const links = await prisma.parentChildLink.findMany({
      where: { childId },
      select: { parentUserId: true },
    });
    return links.map((link) => link.parentUserId);
  }

  /**
   * Send a notification by creating a Notification record in the database.
   * This is the actual dispatch mechanism — in production this could also
   * trigger SMS/push via an external service.
   *
   * Throws on DB error (caught by outer try/catch in dispatch methods).
   */
  private async sendNotification(params: {
    branchId: string;
    userId: string;
    type: 'payment_received' | 'payment_overdue';
    title: string;
    body: string;
    referenceId: string;
    referenceType: string;
  }): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          referenceId: params.referenceId,
          referenceType: params.referenceType,
        },
      });
    } catch (error) {
      // Individual notification failure — record and continue
      this.recordFailure({
        branchId: params.branchId,
        notificationType: params.type === 'payment_overdue' ? 'late' : 'confirmation',
        targetUserId: params.userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Record a dispatch failure entry retrievable by staff (Req 21.5).
   */
  private recordFailure(entry: {
    branchId: string;
    billingPeriodId?: string;
    paymentRecordId?: string;
    notificationType: 'late' | 'confirmation';
    targetUserId: string;
    errorMessage: string;
  }): void {
    failureIdCounter++;
    dispatchFailures.push({
      id: `failure_${failureIdCounter}`,
      branchId: entry.branchId,
      billingPeriodId: entry.billingPeriodId,
      paymentRecordId: entry.paymentRecordId,
      notificationType: entry.notificationType,
      targetUserId: entry.targetUserId,
      errorMessage: entry.errorMessage,
      createdAt: new Date(),
    });
  }

  /**
   * Get today's date as YYYY-MM-DD string for deduplication key.
   */
  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // --- Test Helpers ---

  /**
   * Reset the in-memory deduplication log (for testing purposes).
   */
  _resetDeduplicationLog(): void {
    lateNotificationLog.clear();
  }

  /**
   * Reset all failure entries (for testing purposes).
   */
  _resetFailures(): void {
    dispatchFailures.length = 0;
    failureIdCounter = 0;
  }

  /**
   * Get all deduplication keys (for testing purposes).
   */
  _getDeduplicationKeys(): string[] {
    return Array.from(lateNotificationLog.keys());
  }
}

export const paymentNotificationService = new PaymentNotificationService();
