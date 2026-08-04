import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { paymentNotificationService } from './notification.service';

// Mock prisma
vi.mock('../../lib/prisma', () => {
  return {
    default: {
      branchBillingConfig: {
        findUnique: vi.fn(),
      },
      parentChildLink: {
        findMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    },
  };
});

import prisma from '../../lib/prisma';

const mockBranchConfig = prisma.branchBillingConfig as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
};
const mockParentChildLink = prisma.parentChildLink as unknown as {
  findMany: ReturnType<typeof vi.fn>;
};
const mockNotification = prisma.notification as unknown as {
  create: ReturnType<typeof vi.fn>;
};

describe('PaymentNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentNotificationService._resetDeduplicationLog();
    paymentNotificationService._resetFailures();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dispatchLateNotification', () => {
    it('does nothing when notification setting is disabled', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'disabled',
      });

      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );

      expect(mockParentChildLink.findMany).not.toHaveBeenCalled();
      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('does nothing when branch config does not exist', async () => {
      mockBranchConfig.findUnique.mockResolvedValue(null);

      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );

      expect(mockParentChildLink.findMany).not.toHaveBeenCalled();
      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('dispatches notification to all linked parents when enabled', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([
        { parentUserId: 'parent-1' },
        { parentUserId: 'parent-2' },
      ]);
      mockNotification.create.mockResolvedValue({ id: 'notif-1' });

      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );

      expect(mockNotification.create).toHaveBeenCalledTimes(2);
      expect(mockNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'parent-1',
          type: 'payment_overdue',
          referenceId: 'period-1',
          referenceType: 'billing_period',
        }),
      });
      expect(mockNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'parent-2',
          type: 'payment_overdue',
        }),
      });
    });

    it('deduplicates: does not dispatch twice for the same period on the same day', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([
        { parentUserId: 'parent-1' },
      ]);
      mockNotification.create.mockResolvedValue({ id: 'notif-1' });

      // First call: should dispatch
      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );
      expect(mockNotification.create).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });

      // Second call: should be deduplicated
      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );
      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('does not dispatch when child has no linked parents', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([]);

      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );

      expect(mockNotification.create).not.toHaveBeenCalled();
      // No failure entry should be recorded (Req 21.8)
      expect(paymentNotificationService.getFailuresForBranch('branch-1')).toHaveLength(0);
    });

    it('records failure when notification dispatch throws', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([
        { parentUserId: 'parent-1' },
      ]);
      mockNotification.create.mockRejectedValue(new Error('DB connection lost'));

      // Should not throw
      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );

      const failures = paymentNotificationService.getFailuresForBranch('branch-1');
      expect(failures.length).toBeGreaterThanOrEqual(1);
      expect(failures[0].notificationType).toBe('late');
      expect(failures[0].errorMessage).toBe('DB connection lost');
    });

    it('never throws to caller even on unexpected error', async () => {
      mockBranchConfig.findUnique.mockRejectedValue(new Error('Unexpected failure'));

      // Should not throw
      await expect(
        paymentNotificationService.dispatchLateNotification(
          'branch-1',
          'period-1',
          'child-1',
        ),
      ).resolves.toBeUndefined();

      const failures = paymentNotificationService.getFailuresForBranch('branch-1');
      expect(failures).toHaveLength(1);
      expect(failures[0].errorMessage).toBe('Unexpected failure');
    });
  });

  describe('dispatchPaymentConfirmation', () => {
    it('does nothing when notification setting is disabled', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'disabled',
      });

      await paymentNotificationService.dispatchPaymentConfirmation(
        'branch-1',
        'payment-1',
        'child-1',
      );

      expect(mockParentChildLink.findMany).not.toHaveBeenCalled();
      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('dispatches confirmation to all linked parents when enabled', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([
        { parentUserId: 'parent-1' },
        { parentUserId: 'parent-2' },
      ]);
      mockNotification.create.mockResolvedValue({ id: 'notif-1' });

      await paymentNotificationService.dispatchPaymentConfirmation(
        'branch-1',
        'payment-1',
        'child-1',
      );

      expect(mockNotification.create).toHaveBeenCalledTimes(2);
      expect(mockNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'parent-1',
          type: 'payment_received',
          referenceId: 'payment-1',
          referenceType: 'payment_record',
        }),
      });
    });

    it('does not dispatch when child has no linked parents', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([]);

      await paymentNotificationService.dispatchPaymentConfirmation(
        'branch-1',
        'payment-1',
        'child-1',
      );

      expect(mockNotification.create).not.toHaveBeenCalled();
      expect(paymentNotificationService.getFailuresForBranch('branch-1')).toHaveLength(0);
    });

    it('records failure when notification dispatch throws', async () => {
      mockBranchConfig.findUnique.mockResolvedValue({
        notificationSetting: 'enabled',
      });
      mockParentChildLink.findMany.mockResolvedValue([
        { parentUserId: 'parent-1' },
      ]);
      mockNotification.create.mockRejectedValue(new Error('Network timeout'));

      await paymentNotificationService.dispatchPaymentConfirmation(
        'branch-1',
        'payment-1',
        'child-1',
      );

      const failures = paymentNotificationService.getFailuresForBranch('branch-1');
      expect(failures.length).toBeGreaterThanOrEqual(1);
      expect(failures[0].notificationType).toBe('confirmation');
      expect(failures[0].errorMessage).toBe('Network timeout');
    });

    it('never throws to caller even on unexpected error', async () => {
      mockBranchConfig.findUnique.mockRejectedValue(new Error('Unexpected'));

      await expect(
        paymentNotificationService.dispatchPaymentConfirmation(
          'branch-1',
          'payment-1',
          'child-1',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('getFailuresForBranch', () => {
    it('returns only failures for the specified branch', async () => {
      mockBranchConfig.findUnique.mockRejectedValue(new Error('err1'));

      await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );
      await paymentNotificationService.dispatchLateNotification(
        'branch-2',
        'period-2',
        'child-2',
      );

      const branch1Failures = paymentNotificationService.getFailuresForBranch('branch-1');
      const branch2Failures = paymentNotificationService.getFailuresForBranch('branch-2');

      expect(branch1Failures).toHaveLength(1);
      expect(branch1Failures[0].branchId).toBe('branch-1');
      expect(branch2Failures).toHaveLength(1);
      expect(branch2Failures[0].branchId).toBe('branch-2');
    });

    it('returns empty array when no failures exist', () => {
      expect(paymentNotificationService.getFailuresForBranch('branch-x')).toHaveLength(0);
    });
  });

  describe('clearFailuresForBranch', () => {
    it('removes failures for the specified branch only', async () => {
      mockBranchConfig.findUnique.mockRejectedValue(new Error('err'));

      await paymentNotificationService.dispatchLateNotification('branch-1', 'p1', 'c1');
      await paymentNotificationService.dispatchLateNotification('branch-2', 'p2', 'c2');

      paymentNotificationService.clearFailuresForBranch('branch-1');

      expect(paymentNotificationService.getFailuresForBranch('branch-1')).toHaveLength(0);
      expect(paymentNotificationService.getFailuresForBranch('branch-2')).toHaveLength(1);
    });
  });

  describe('payment recording independence (Req 21.6)', () => {
    it('dispatch methods return void and never throw regardless of outcome', async () => {
      // All DB calls fail
      mockBranchConfig.findUnique.mockRejectedValue(new Error('total failure'));

      const lateResult = await paymentNotificationService.dispatchLateNotification(
        'branch-1',
        'period-1',
        'child-1',
      );
      const confirmResult = await paymentNotificationService.dispatchPaymentConfirmation(
        'branch-1',
        'payment-1',
        'child-1',
      );

      expect(lateResult).toBeUndefined();
      expect(confirmResult).toBeUndefined();
    });
  });
});
