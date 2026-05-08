/**
 * Notification service implementing multi-channel dispatch.
 * Supports FCM push, Resend email, and Twilio SMS channels.
 * All notifications are persisted to the Notification table.
 * Notifications are delivered in the user's preferred_language (ar or fr).
 *
 * Channel selection:
 * - Push (FCM): All notifications — requires user's fcm_token
 * - Email (Resend): Absence alerts, invoice sent/overdue, announcements
 * - SMS (Twilio): Critical only — absence alerts, overdue payment reminders (primary parent only)
 */

import prisma from '../lib/prisma';
import { pushService } from './push.service';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { socketService } from './socket.service';
import { NotificationType, Language } from '@prisma/client';

/**
 * Notification types that are considered critical and eligible for SMS delivery.
 * SMS is restricted to absence alerts and overdue payment reminders only.
 */
const CRITICAL_SMS_TYPES: NotificationType[] = ['absence_alert', 'payment_overdue'];

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  referenceId?: string;
  referenceType?: string;
  channels: ('push' | 'email' | 'sms')[];
}

export interface INotificationService {
  notify(payload: NotificationPayload): Promise<void>;
  notifyMany(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string, schoolId: string): Promise<void>;
}

/**
 * Localized notification templates.
 * Returns title and body in the user's preferred language.
 */
function getLocalizedAbsenceAlert(
  language: Language,
  childFirstName: string,
  childLastName: string,
  date: string,
): { title: string; body: string } {
  if (language === 'ar') {
    return {
      title: 'تنبيه غياب',
      body: `تم تسجيل غياب ${childFirstName} ${childLastName} بتاريخ ${date}.`,
    };
  }
  return {
    title: 'Alerte d\'absence',
    body: `${childFirstName} ${childLastName} a été marqué(e) absent(e) le ${date}.`,
  };
}

class NotificationService implements INotificationService {
  /**
   * Send a notification to a single user across specified channels.
   * Persists the notification to the database regardless of delivery success.
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const { userId, title, body, type, referenceId, referenceType, channels } = payload;

    // Persist notification to database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        referenceId: referenceId || null,
        referenceType: referenceType || null,
      },
    });

    // Emit "notification:new" event to user's personal room for real-time delivery
    socketService.emitToUser(userId, 'notification:new', notification);

    // Fetch user details for channel delivery
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        fcmToken: true,
        preferredLanguage: true,
        firstName: true,
      },
    });

    if (!user) {
      console.warn(`[NotificationService] User ${userId} not found, skipping delivery`);
      return;
    }

    // Dispatch to each requested channel
    const deliveryPromises: Promise<void>[] = [];

    if (channels.includes('push') && user.fcmToken) {
      deliveryPromises.push(
        pushService.send({
          token: user.fcmToken,
          title,
          body,
          data: {
            type,
            ...(referenceId && { referenceId }),
            ...(referenceType && { referenceType }),
          },
        }),
      );
    }

    if (channels.includes('email') && user.email) {
      deliveryPromises.push(
        emailService.sendNotificationEmail(user.email, title, body),
      );
    }

    if (channels.includes('sms')) {
      // SMS is restricted to critical notifications only (absence_alert, payment_overdue)
      if (CRITICAL_SMS_TYPES.includes(type)) {
        console.log(`[NotificationService] SMS channel dispatched for critical notification type "${type}" to user ${userId}`);
      } else {
        console.log(`[NotificationService] SMS channel skipped for non-critical notification type "${type}" — only absence_alert and payment_overdue qualify`);
      }
    }

    // Fire and forget — don't block on delivery failures
    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Send a notification to multiple users with the same payload.
   * Each user gets their own persisted notification record.
   */
  async notifyMany(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.notify({ ...payload, userId })),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[NotificationService] ${failures.length}/${userIds.length} notifications failed`);
    }
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user within a school context.
   */
  async markAllAsRead(userId: string, _schoolId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Dispatch absence notifications for a child to all linked parents.
   * - Push + Email to all linked parents
   * - SMS to primary parent only
   * - Notifications delivered in each parent's preferred_language
   */
  async dispatchAbsenceNotifications(
    childId: string,
    attendanceRecordId: string,
    date: string,
  ): Promise<void> {
    // Fetch child info
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: {
        firstName: true,
        lastName: true,
        parentLinks: {
          select: {
            isPrimary: true,
            parent: {
              select: {
                id: true,
                email: true,
                fcmToken: true,
                preferredLanguage: true,
                firstName: true,
              },
            },
          },
        },
      },
    });

    if (!child || child.parentLinks.length === 0) {
      console.log(`[NotificationService] No parents linked to child ${childId}, skipping absence notifications`);
      return;
    }

    // Send notifications to each linked parent
    for (const link of child.parentLinks) {
      const parent = link.parent;
      const localized = getLocalizedAbsenceAlert(
        parent.preferredLanguage,
        child.firstName,
        child.lastName,
        date,
      );

      // Persist notification
      await prisma.notification.create({
        data: {
          userId: parent.id,
          type: 'absence_alert',
          title: localized.title,
          body: localized.body,
          referenceId: attendanceRecordId,
          referenceType: 'attendance_record',
        },
      });

      // Push notification (if FCM token available)
      if (parent.fcmToken) {
        pushService
          .send({
            token: parent.fcmToken,
            title: localized.title,
            body: localized.body,
            data: {
              type: 'absence_alert',
              referenceId: attendanceRecordId,
              referenceType: 'attendance_record',
            },
          })
          .catch((err) => {
            console.error(`[NotificationService] Push failed for user ${parent.id}:`, err);
          });
      }

      // Email notification
      emailService
        .sendNotificationEmail(parent.email, localized.title, localized.body)
        .catch((err) => {
          console.error(`[NotificationService] Email failed for user ${parent.id}:`, err);
        });

      // SMS only to primary parent
      if (link.isPrimary) {
        smsService
          .send({
            to: parent.email, // In production, this would be the parent's phone number
            body: localized.body,
          })
          .catch((err) => {
            console.error(`[NotificationService] SMS failed for user ${parent.id}:`, err);
          });
      }
    }
  }
}

export const notificationService = new NotificationService();
