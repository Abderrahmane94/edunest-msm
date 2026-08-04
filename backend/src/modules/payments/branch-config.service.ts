import prisma from '../../lib/prisma';
import type { CreateBranchConfigInput, UpdateBranchConfigInput } from './payments.schema';

export class BranchConfigServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BRANCH_CONFIG_ERROR',
  ) {
    super(message);
    this.name = 'BranchConfigServiceError';
  }
}

class BranchConfigService {
  /**
   * Create a billing configuration for a branch.
   * Rejects if a config already exists for this branch.
   */
  async createConfig(branchId: string, data: CreateBranchConfigInput) {
    // Verify branch exists
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new BranchConfigServiceError('Branch not found', 404, 'NOT_FOUND');
    }

    // Check no existing config
    const existing = await prisma.branchBillingConfig.findUnique({
      where: { branchId },
    });
    if (existing) {
      throw new BranchConfigServiceError(
        'A billing configuration already exists for this branch',
        409,
        'CONFLICT',
      );
    }

    const config = await prisma.branchBillingConfig.create({
      data: {
        branchId,
        billingCycle: data.billing_cycle,
        billingDueDay: data.billing_due_day,
        gracePeriodDays: data.grace_period_days,
        defaultRecurringFee: data.default_recurring_fee,
        notificationSetting: data.notification_setting ?? 'disabled',
      },
    });

    return config;
  }

  /**
   * Update billing configuration for a branch.
   * Returns updated config along with count of already-generated billing periods left unchanged.
   */
  async updateConfig(branchId: string, data: UpdateBranchConfigInput) {
    const existing = await prisma.branchBillingConfig.findUnique({
      where: { branchId },
    });
    if (!existing) {
      throw new BranchConfigServiceError(
        'No billing configuration found for this branch',
        404,
        'NOT_FOUND',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.billing_cycle !== undefined) updateData.billingCycle = data.billing_cycle;
    if (data.billing_due_day !== undefined) updateData.billingDueDay = data.billing_due_day;
    if (data.grace_period_days !== undefined) updateData.gracePeriodDays = data.grace_period_days;
    if (data.default_recurring_fee !== undefined) updateData.defaultRecurringFee = data.default_recurring_fee;
    if (data.notification_setting !== undefined) updateData.notificationSetting = data.notification_setting;

    const config = await prisma.branchBillingConfig.update({
      where: { branchId },
      data: updateData,
    });

    // Count already-generated billing periods left unchanged
    const unchangedCount = await this.countGeneratedPeriodsForBranch(branchId);

    return { config, unchangedPeriodsCount: unchangedCount };
  }

  /**
   * Get billing configuration for a branch.
   * Returns null if no config exists.
   */
  async getConfig(branchId: string) {
    const config = await prisma.branchBillingConfig.findUnique({
      where: { branchId },
    });

    return config;
  }

  /**
   * Count already-generated billing periods for all enrollments of a branch.
   * This is the count of periods left unchanged when config is updated (Req 6.7).
   */
  private async countGeneratedPeriodsForBranch(branchId: string): Promise<number> {
    const count = await prisma.billingPeriod.count({
      where: {
        enrollment: {
          branchId,
        },
      },
    });

    return count;
  }
}

export const branchConfigService = new BranchConfigService();
