import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  default: {
    notification: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    child: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock push service
vi.mock('./push.service', () => ({
  pushService: {
    send: vi.fn().mockResolvedValue(undefined),
    sendToMany: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock email service
vi.mock('./email.service', () => ({
  emailService: {
    sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock sms service
vi.mock('./sms.service', () => ({
  smsService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock socket service
vi.mock('./socket.service', () => ({
  socketService: {
    emitToUser: vi.fn(),
    emitToRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
  },
}));

import prisma from '../lib/prisma';
import { pushService } from './push.service';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { notificationService } from './notification.service';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notify', () => {
    it('should persist notification to database and dispatch to push channel', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        type: 'absence_alert',
        title: 'Test Title',
        body: 'Test Body',
        referenceId: 'ref-1',
        referenceType: 'attendance_record',
        isRead: false,
        createdAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: 'parent@test.com',
        fcmToken: 'fcm-token-123',
        preferredLanguage: 'fr',
        firstName: 'Parent',
      } as any);

      await notificationService.notify({
        userId: 'user-1',
        title: 'Test Title',
        body: 'Test Body',
        type: 'absence_alert',
        referenceId: 'ref-1',
        referenceType: 'attendance_record',
        channels: ['push'],
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'absence_alert',
          title: 'Test Title',
          body: 'Test Body',
          referenceId: 'ref-1',
          referenceType: 'attendance_record',
        },
      });

      expect(pushService.send).toHaveBeenCalledWith({
        token: 'fcm-token-123',
        title: 'Test Title',
        body: 'Test Body',
        data: {
          type: 'absence_alert',
          referenceId: 'ref-1',
          referenceType: 'attendance_record',
        },
      });
    });

    it('should dispatch to email channel when requested', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-2',
        userId: 'user-1',
        type: 'absence_alert',
        title: 'Alert',
        body: 'Body',
        referenceId: null,
        referenceType: null,
        isRead: false,
        createdAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: 'parent@test.com',
        fcmToken: null,
        preferredLanguage: 'fr',
        firstName: 'Parent',
      } as any);

      await notificationService.notify({
        userId: 'user-1',
        title: 'Alert',
        body: 'Body',
        type: 'absence_alert',
        channels: ['email'],
      });

      expect(emailService.sendNotificationEmail).toHaveBeenCalledWith(
        'parent@test.com',
        'Alert',
        'Body',
      );
    });

    it('should not send push when user has no fcm_token', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-3',
        userId: 'user-1',
        type: 'absence_alert',
        title: 'Alert',
        body: 'Body',
        referenceId: null,
        referenceType: null,
        isRead: false,
        createdAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: 'parent@test.com',
        fcmToken: null,
        preferredLanguage: 'fr',
        firstName: 'Parent',
      } as any);

      await notificationService.notify({
        userId: 'user-1',
        title: 'Alert',
        body: 'Body',
        type: 'absence_alert',
        channels: ['push'],
      });

      expect(pushService.send).not.toHaveBeenCalled();
    });

    it('should skip delivery when user not found', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-4',
        userId: 'user-missing',
        type: 'absence_alert',
        title: 'Alert',
        body: 'Body',
        referenceId: null,
        referenceType: null,
        isRead: false,
        createdAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await notificationService.notify({
        userId: 'user-missing',
        title: 'Alert',
        body: 'Body',
        type: 'absence_alert',
        channels: ['push', 'email'],
      });

      expect(pushService.send).not.toHaveBeenCalled();
      expect(emailService.sendNotificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyMany', () => {
    it('should send notifications to multiple users', async () => {
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-x',
        userId: 'user-x',
        type: 'announcement',
        title: 'News',
        body: 'Content',
        referenceId: null,
        referenceType: null,
        isRead: false,
        createdAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: 'user@test.com',
        fcmToken: 'token',
        preferredLanguage: 'fr',
        firstName: 'User',
      } as any);

      await notificationService.notifyMany(['user-1', 'user-2', 'user-3'], {
        title: 'News',
        body: 'Content',
        type: 'announcement',
        channels: ['push'],
      });

      expect(prisma.notification.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('markAsRead', () => {
    it('should update notification isRead to true', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 });

      await notificationService.markAsRead('notif-1', 'user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { isRead: true },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for a user', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 });

      await notificationService.markAllAsRead('user-1', 'school-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('dispatchAbsenceNotifications', () => {
    it('should send push and email to all parents, SMS to primary parent only', async () => {
      vi.mocked(prisma.child.findUnique).mockResolvedValue({
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
        parentLinks: [
          {
            isPrimary: true,
            parent: {
              id: 'parent-1',
              email: 'primary@test.com',
              phone: '+213600000001',
              fcmToken: 'fcm-primary',
              preferredLanguage: 'fr',
              firstName: 'Fatima',
            },
          },
          {
            isPrimary: false,
            parent: {
              id: 'parent-2',
              email: 'secondary@test.com',
              fcmToken: 'fcm-secondary',
              preferredLanguage: 'ar',
              firstName: 'Mohamed',
            },
          },
        ],
      } as any);

      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-absence',
        userId: 'parent-1',
        type: 'absence_alert',
        title: 'Alerte d\'absence',
        body: 'Ahmed Ben Ali a été marqué(e) absent(e) le 2024-01-15.',
        referenceId: 'att-1',
        referenceType: 'attendance_record',
        isRead: false,
        createdAt: new Date(),
      });

      await notificationService.dispatchAbsenceNotifications('child-1', 'att-1', '2024-01-15');

      // Should persist 2 notifications (one per parent)
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);

      // Should send push to both parents
      expect(pushService.send).toHaveBeenCalledTimes(2);

      // Should send email to both parents
      expect(emailService.sendNotificationEmail).toHaveBeenCalledTimes(2);

      // Should send SMS only to primary parent
      expect(smsService.send).toHaveBeenCalledTimes(1);
      expect(smsService.send).toHaveBeenCalledWith({
        to: '+213600000001',
        body: 'Ahmed Ben Ali a été marqué(e) absent(e) le 2024-01-15.',
      });
    });

    it('should deliver notifications in Arabic for parents with ar preference', async () => {
      vi.mocked(prisma.child.findUnique).mockResolvedValue({
        firstName: 'أحمد',
        lastName: 'بن علي',
        parentLinks: [
          {
            isPrimary: true,
            parent: {
              id: 'parent-ar',
              email: 'arabic@test.com',
              fcmToken: 'fcm-ar',
              preferredLanguage: 'ar',
              firstName: 'فاطمة',
            },
          },
        ],
      } as any);

      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'notif-ar',
        userId: 'parent-ar',
        type: 'absence_alert',
        title: 'تنبيه غياب',
        body: 'تم تسجيل غياب أحمد بن علي بتاريخ 2024-01-15.',
        referenceId: 'att-2',
        referenceType: 'attendance_record',
        isRead: false,
        createdAt: new Date(),
      });

      await notificationService.dispatchAbsenceNotifications('child-ar', 'att-2', '2024-01-15');

      // Verify Arabic notification was persisted
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'parent-ar',
          type: 'absence_alert',
          title: 'تنبيه غياب',
          body: 'تم تسجيل غياب أحمد بن علي بتاريخ 2024-01-15.',
          referenceId: 'att-2',
          referenceType: 'attendance_record',
        },
      });
    });

    it('should skip notifications when child has no linked parents', async () => {
      vi.mocked(prisma.child.findUnique).mockResolvedValue({
        firstName: 'Orphan',
        lastName: 'Child',
        parentLinks: [],
      } as any);

      await notificationService.dispatchAbsenceNotifications('child-no-parents', 'att-3', '2024-01-15');

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(pushService.send).not.toHaveBeenCalled();
      expect(emailService.sendNotificationEmail).not.toHaveBeenCalled();
      expect(smsService.send).not.toHaveBeenCalled();
    });

    it('should skip notifications when child not found', async () => {
      vi.mocked(prisma.child.findUnique).mockResolvedValue(null);

      await notificationService.dispatchAbsenceNotifications('child-missing', 'att-4', '2024-01-15');

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(pushService.send).not.toHaveBeenCalled();
    });
  });
});
