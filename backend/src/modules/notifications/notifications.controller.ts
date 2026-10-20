import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import { pushDevices } from '../../services/push-devices.service';
import type { ListNotificationsQuery, PushDeviceInput } from './notifications.schema';

/** Read notifications older than this go by themselves, so the list never grows without end. */
export const READ_NOTIFICATION_DAYS = 90;

/**
 * The test notification, in the person's language: what will arrive here
 * from now on. The phone already shows "Kiddoo" and the site above it, so
 * the title says the news instead.
 */
export function testNotificationText(language: string, role: string, school: string | null): { title: string; body: string } {
  const parent = role === 'parent';
  if (language === 'ar') {
    const from = school ? `من ${school}` : 'من الروضة';
    return {
      title: 'الإشعارات مفعّلة ✅',
      body: parent
        ? `ستصلك هنا رسائل ${school ?? 'الروضة'} وغيابات أطفالك والإعلانات، حتى عندما يكون التطبيق مغلقًا.`
        : `ستصلك هنا رسائل الأولياء والفريق والإعلانات ${from}، حتى عندما يكون التطبيق مغلقًا.`,
    };
  }
  return {
    title: 'Notifications activées ✅',
    body: parent
      ? `Vous recevrez ici les messages ${school ? `de ${school}` : 'de la crèche'}, les absences de vos enfants et les annonces, même quand l'application est fermée.`
      : `Vous recevrez ici les messages des parents et de l'équipe${school ? ` de ${school}` : ''}, même quand l'application est fermée.`,
  };
}

export const notificationsController = {
  /**
   * POST /api/notifications/devices — This device gets the person's notifications
   */
  async registerDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await pushDevices.register(req.user!.userId, (req.body as PushDeviceInput).token);
      res.status(200).json(successResponse({ registered: true }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/notifications/devices/forget — Signing out: this device stops getting them
   */
  async forgetDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await pushDevices.unregister(req.user!.userId, (req.body as PushDeviceInput).token);
      res.status(200).json(successResponse({ forgotten: true }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/notifications/devices/test — A test notification to each of the person's devices
   */
  async testDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferredLanguage: true, role: true, school: { select: { name: true } } },
      });
      const text = testNotificationText(user?.preferredLanguage ?? 'fr', user?.role ?? '', user?.school?.name ?? null);
      const result = await pushDevices.send(userId, { ...text, data: { type: 'test', role: user?.role ?? '' } });
      res.status(200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/notifications — List the authenticated user's notifications (paginated)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page, pageSize } = req.query as unknown as ListNotificationsQuery;

      // Opening the list: this person's old read ones are dropped first.
      if (page === 1) {
        await prisma.notification.deleteMany({
          where: { userId, isRead: true, createdAt: { lt: new Date(Date.now() - READ_NOTIFICATION_DAYS * 24 * 60 * 60 * 1000) } },
        });
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      res.status(200).json(paginatedResponse(notifications, page, pageSize, total));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/notifications/unread-count — Get unread notification count for the authenticated user
   */
  async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const count = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      res.status(200).json(successResponse({ count }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/notifications/:id/read — Mark a single notification as read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      // Verify the notification belongs to the authenticated user
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Notification not found'));
        return;
      }

      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      res.status(200).json(successResponse({ message: 'Notification marked as read' }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/notifications/read-all — Mark all notifications as read for the authenticated user
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      res.status(200).json(successResponse({ message: 'All notifications marked as read' }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/notifications/:id — Remove one of the user's notifications
   * (only the alert: what it points to stays).
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { count } = await prisma.notification.deleteMany({
        where: { id: req.params.id, userId: req.user!.userId },
      });
      if (count === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Notification not found'));
        return;
      }
      res.status(200).json(successResponse({ deleted: count }));
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/notifications/read — Remove the user's read notifications
   * (never one not seen yet).
   */
  async removeRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { count } = await prisma.notification.deleteMany({
        where: { userId: req.user!.userId, isRead: true },
      });
      res.status(200).json(successResponse({ deleted: count }));
    } catch (error) {
      next(error);
    }
  },
};
