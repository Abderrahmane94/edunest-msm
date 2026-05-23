import { Router } from 'express';
import { communicationController } from './communication.controller';
import { requireTeacherOrAdmin, requireActiveRole, requireAdmin, rbac } from '../../middleware/rbac.middleware';
import { validate, validateParams, validateQuery } from '../../middleware/validation.middleware';
import {
  createConversationSchema,
  sendMessageSchema,
  conversationIdParamSchema,
  messageIdParamSchema,
  messagesQuerySchema,
  createDailyReportSchema,
  childIdParamSchema,
  dailyReportIdParamSchema,
  uploadDailyReportPhotoSchema,
  dailyReportsQuerySchema,
  createAnnouncementSchema,
  announcementIdParamSchema,
  announcementsQuerySchema,
  createEventSchema,
  eventIdParamSchema,
  consentResponseParamSchema,
  respondConsentSchema,
  eventsQuerySchema,
} from './communication.schema';

const router = Router();

// ─── Conversations ───────────────────────────────────────────────────────────

// POST /api/communication/conversations — Create a conversation (teacher or admin)
router.post(
  '/conversations',
  requireTeacherOrAdmin,
  validate(createConversationSchema),
  communicationController.createConversation,
);

// GET /api/communication/conversations/pending — List pending conversations (admin only)
router.get(
  '/conversations/pending',
  requireAdmin,
  communicationController.listPendingConversations,
);

// GET /api/communication/conversations — List user's conversations (teacher, parent, admin)
router.get(
  '/conversations',
  requireActiveRole,
  validateQuery(messagesQuerySchema),
  communicationController.listConversations,
);

// GET /api/communication/conversations/:id/messages — Get messages (teacher, parent, admin)
router.get(
  '/conversations/:id/messages',
  requireActiveRole,
  validateParams(conversationIdParamSchema),
  validateQuery(messagesQuerySchema),
  communicationController.getMessages,
);

// POST /api/communication/conversations/:id/messages — Send a message (teacher, parent)
router.post(
  '/conversations/:id/messages',
  rbac(['teacher', 'parent']),
  validateParams(conversationIdParamSchema),
  validate(sendMessageSchema),
  communicationController.sendMessage,
);

// PATCH /api/communication/messages/:id/read — Mark message as read (teacher, parent)
router.patch(
  '/messages/:id/read',
  rbac(['teacher', 'parent']),
  validateParams(messageIdParamSchema),
  communicationController.markAsRead,
);

// ─── Daily Reports ───────────────────────────────────────────────────────────

// POST /api/communication/daily-reports — Create daily report (teacher, admin)
router.post(
  '/daily-reports',
  requireTeacherOrAdmin,
  validate(createDailyReportSchema),
  communicationController.createDailyReport,
);

// GET /api/communication/daily-reports/my-children — Get reports for parent's linked children
router.get(
  '/daily-reports/my-children',
  requireActiveRole,
  communicationController.getReportsForMyChildren,
);

// GET /api/communication/daily-reports/child/:childId — Get reports for a child (teacher, admin, parent)
router.get(
  '/daily-reports/child/:childId',
  requireActiveRole,
  validateParams(childIdParamSchema),
  validateQuery(dailyReportsQuerySchema),
  communicationController.getDailyReportsForChild,
);

// GET /api/communication/daily-reports/:id — Get single report (teacher, admin, parent)
router.get(
  '/daily-reports/:id',
  requireActiveRole,
  validateParams(dailyReportIdParamSchema),
  communicationController.getDailyReport,
);

// POST /api/communication/daily-reports/:id/photos — Upload photo to report (teacher, admin)
router.post(
  '/daily-reports/:id/photos',
  requireTeacherOrAdmin,
  validateParams(dailyReportIdParamSchema),
  validate(uploadDailyReportPhotoSchema),
  communicationController.uploadDailyReportPhoto,
);

// ─── Announcements ───────────────────────────────────────────────────────────

// POST /api/communication/announcements — Create and publish announcement (admin only)
router.post(
  '/announcements',
  requireAdmin,
  validate(createAnnouncementSchema),
  communicationController.createAnnouncement,
);

// GET /api/communication/announcements — List announcements (admin, teacher, parent)
router.get(
  '/announcements',
  requireActiveRole,
  validateQuery(announcementsQuerySchema),
  communicationController.listAnnouncements,
);

// GET /api/communication/announcements/:id — Get single announcement (admin, teacher, parent)
router.get(
  '/announcements/:id',
  requireActiveRole,
  validateParams(announcementIdParamSchema),
  communicationController.getAnnouncement,
);

// DELETE /api/communication/announcements/:id — Delete announcement (admin only)
router.delete(
  '/announcements/:id',
  requireAdmin,
  validateParams(announcementIdParamSchema),
  communicationController.deleteAnnouncement,
);

// ─── Events & Consent Forms ─────────────────────────────────────────────────

// POST /api/communication/events — Create event (admin only)
router.post(
  '/events',
  requireAdmin,
  validate(createEventSchema),
  communicationController.createEvent,
);

// GET /api/communication/events — List events (admin, teacher, parent)
router.get(
  '/events',
  requireActiveRole,
  validateQuery(eventsQuerySchema),
  communicationController.listEvents,
);

// GET /api/communication/events/:id — Get event with consent forms (admin, teacher, parent)
router.get(
  '/events/:id',
  requireActiveRole,
  validateParams(eventIdParamSchema),
  communicationController.getEvent,
);

// DELETE /api/communication/events/:id — Delete event (admin only)
router.delete(
  '/events/:id',
  requireAdmin,
  validateParams(eventIdParamSchema),
  communicationController.deleteEvent,
);

// PATCH /api/communication/events/:eventId/consent/:childId — Respond to consent form (parent only)
router.patch(
  '/events/:eventId/consent/:childId',
  rbac(['parent']),
  validateParams(consentResponseParamSchema),
  validate(respondConsentSchema),
  communicationController.respondToConsent,
);

export default router;
