import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { ListNotificationsQuery } from './notifications.schema';

/** Read notifications older than this go by themselves, so the list never grows without end. */
export const READ_NOTIFICATION_DAYS = 90;

export const notificationsController = {
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
