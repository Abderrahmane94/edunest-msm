import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { requireActiveRole } from '../../middleware/rbac.middleware';
import { validateParams, validateQuery } from '../../middleware/validation.middleware';
import { listNotificationsQuerySchema, notificationIdParamSchema } from './notifications.schema';

const router = Router();

// GET /api/notifications — List user's notifications (paginated)
router.get(
  '/',
  requireActiveRole,
  validateQuery(listNotificationsQuerySchema),
  notificationsController.list,
);

// GET /api/notifications/unread-count — Get unread notification count
router.get(
  '/unread-count',
  requireActiveRole,
  notificationsController.unreadCount,
);

// PATCH /api/notifications/read-all — Mark all notifications as read
router.patch(
  '/read-all',
  requireActiveRole,
  notificationsController.markAllAsRead,
);

// PATCH /api/notifications/:id/read — Mark single notification as read
router.patch(
  '/:id/read',
  requireActiveRole,
  validateParams(notificationIdParamSchema),
  notificationsController.markAsRead,
);

// DELETE /api/notifications/read — Remove the read notifications
router.delete(
  '/read',
  requireActiveRole,
  notificationsController.removeRead,
);

// DELETE /api/notifications/:id — Remove one notification
router.delete(
  '/:id',
  requireActiveRole,
  validateParams(notificationIdParamSchema),
  notificationsController.remove,
);

export default router;
