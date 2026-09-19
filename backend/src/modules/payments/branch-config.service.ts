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
        notificationSetting: data.notification_setting ?? 'disabled',
      },
    });

    return config;
  }

  /**
   * Update billing configuration for a branch.
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
    if (data.notification_setting !== undefined) updateData.notificationSetting = data.notification_setting;

    return prisma.branchBillingConfig.update({
      where: { branchId },
      data: updateData,
    });
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
}

export const branchConfigService = new BranchConfigService();
