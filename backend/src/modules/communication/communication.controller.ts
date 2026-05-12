import { Request, Response, NextFunction } from 'express';
import { communicationService, CommunicationServiceError } from './communication.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateConversationInput, SendMessageInput, CreateDailyReportInput, UploadDailyReportPhotoInput, CreateAnnouncementInput, CreateEventInput, RespondConsentInput, MessagesQuery, DailyReportsQuery, AnnouncementsQuery, EventsQuery } from './communication.schema';

export const communicationController = {
  /**
   * POST /api/communication/conversations — Create a conversation
   */
  async createConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const input = req.body as CreateConversationInput;

      const conversation = await communicationService.createConversation(
        schoolId,
        userId,
        userRole,
        input,
      );
      res.status(201).json(successResponse(conversation));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/conversations — List user's conversations
   */
  async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { page, pageSize } = req.query as unknown as MessagesQuery;

      const { conversations, total } = await communicationService.listConversations(
        schoolId,
        userId,
        userRole,
        page,
        pageSize,
      );
      res.status(200).json(paginatedResponse(conversations, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/conversations/:id/messages — Get messages in a conversation
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const { page, pageSize } = req.query as unknown as MessagesQuery;

      const { messages, total } = await communicationService.getMessages(
        id,
        schoolId,
        userId,
        userRole,
        page,
        pageSize,
      );
      res.status(200).json(paginatedResponse(messages, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/communication/conversations/:id/messages — Send a message
   */
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const input = req.body as SendMessageInput;

      const message = await communicationService.sendMessage(
        id,
        schoolId,
        userId,
        userRole,
        input,
      );
      res.status(201).json(successResponse(message));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/communication/messages/:id/read — Mark a message as read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;

      const message = await communicationService.markMessageAsRead(
        id,
        schoolId,
        userId,
        userRole,
      );
      res.status(200).json(successResponse(message));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/communication/daily-reports — Create a daily report
   */
  async createDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const input = req.body as CreateDailyReportInput;

      const report = await communicationService.createDailyReport(
        schoolId,
        userId,
        userRole,
        input,
      );
      res.status(201).json(successResponse(report));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/daily-reports/my-children — Get reports for parent's linked children
   */
  async getReportsForMyChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;

      const reports = await communicationService.getReportsForParent(schoolId, userId);
      res.status(200).json(successResponse(reports));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/daily-reports/child/:childId — Get reports for a child
   */
  async getDailyReportsForChild(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { childId } = req.params;
      const { page, pageSize, date } = req.query as unknown as DailyReportsQuery;

      const { reports, total } = await communicationService.getDailyReportsForChild(
        childId,
        schoolId,
        userId,
        userRole,
        page,
        pageSize,
        date,
      );
      res.status(200).json(paginatedResponse(reports, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/daily-reports/:id — Get a single daily report
   */
  async getDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;

      const report = await communicationService.getDailyReportById(
        id,
        schoolId,
        userId,
        userRole,
      );
      res.status(200).json(successResponse(report));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/communication/daily-reports/:id/photos — Upload photo to a report
   */
  async uploadDailyReportPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { id } = req.params;
      const input = req.body as UploadDailyReportPhotoInput;

      const photo = await communicationService.uploadDailyReportPhoto(
        id,
        schoolId,
        userId,
        userRole,
        input,
      );
      res.status(201).json(successResponse(photo));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Announcements ───────────────────────────────────────────────────────────

  /**
   * POST /api/communication/announcements — Create and publish an announcement (admin only)
   */
  async createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const input = req.body as CreateAnnouncementInput;

      const announcement = await communicationService.createAnnouncement(
        schoolId,
        userId,
        input,
      );
      res.status(201).json(successResponse(announcement));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/announcements — List announcements
   */
  async listAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { page, pageSize, classroomId } = req.query as unknown as AnnouncementsQuery;

      const { announcements, total } = await communicationService.listAnnouncements(
        schoolId,
        page,
        pageSize,
        classroomId,
      );
      res.status(200).json(paginatedResponse(announcements, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/announcements/:id — Get a single announcement
   */
  async getAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;

      const announcement = await communicationService.getAnnouncementById(id, schoolId);
      res.status(200).json(successResponse(announcement));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  async deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      await communicationService.deleteAnnouncement(id, schoolId);
      res.status(200).json(successResponse({ message: 'Announcement deleted' }));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Events & Consent Forms ──────────────────────────────────────────────────

  /**
   * POST /api/communication/events — Create an event (admin only)
   */
  async createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const input = req.body as CreateEventInput;

      const event = await communicationService.createEvent(schoolId, userId, input);
      res.status(201).json(successResponse(event));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/events — List events
   */
  async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { page, pageSize } = req.query as unknown as EventsQuery;

      const { events, total } = await communicationService.listEvents(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(events, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/events/:id — Get event with consent forms
   */
  async getEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;

      const event = await communicationService.getEventById(id, schoolId);
      res.status(200).json(successResponse(event));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  async deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      await communicationService.deleteEvent(id, schoolId);
      res.status(200).json(successResponse({ message: 'Event deleted' }));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/communication/events/:eventId/consent/:childId — Respond to consent form (parent only)
   */
  async respondToConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const { eventId, childId } = req.params;
      const input = req.body as RespondConsentInput;

      const consentForm = await communicationService.respondToConsent(
        eventId,
        childId,
        schoolId,
        userId,
        input,
      );
      res.status(200).json(successResponse(consentForm));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('COMMUNICATION_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
