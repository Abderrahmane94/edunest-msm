import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { staffMessagingService } from './staff-messaging.service';
import { CommunicationServiceError } from './communication.service';
import { cloudinaryService } from '../../services/cloudinary.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';

const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

export const staffMessagingUpload = uploadFile.single('file');

export const staffMessagingController = {
  /**
   * GET /api/communication/staff/colleagues
   * List staff colleagues (teachers + admins) in the same school.
   */
  async listColleagues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const staff = await staffMessagingService.listStaffColleagues(schoolId, userId);
      res.status(200).json(successResponse(staff));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/communication/staff/conversations
   * Get or create a conversation with a specific staff member.
   * Body: { targetUserId: string }
   */
  async getOrCreateConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { targetUserId } = req.body as { targetUserId: string };

      if (!targetUserId) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'targetUserId is required'));
        return;
      }

      const conversation = await staffMessagingService.getOrCreateConversation(
        schoolId,
        userId,
        userRole,
        targetUserId,
      );

      res.status(200).json(successResponse({ conversation }));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/staff/conversations
   * List all staff conversations for the current user.
   */
  async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;

      const { conversations, total } = await staffMessagingService.listConversations(
        schoolId,
        userId,
        page,
        pageSize,
      );

      res.status(200).json(paginatedResponse(conversations, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/communication/staff/conversations/:id/messages
   * Get messages in a staff conversation.
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { id } = req.params;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 50;

      const { messages, total } = await staffMessagingService.getMessages(
        id,
        schoolId,
        userId,
        page,
        pageSize,
      );

      res.status(200).json(paginatedResponse(messages, page, pageSize, total));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/communication/staff/conversations/:id/messages
   * Send a text message.
   */
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { id } = req.params;
      const { content, messageType } = req.body as {
        content?: string;
        messageType?: 'text' | 'photo' | 'document';
      };

      const type = messageType || 'text';

      if (type === 'text' && (!content || !content.trim())) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Content is required for text messages'));
        return;
      }

      const message = await staffMessagingService.sendMessage(
        id,
        schoolId,
        userId,
        content?.trim() || '',
        type,
      );

      res.status(201).json(successResponse(message));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/communication/staff/conversations/:id/messages (multipart/form-data)
   * Send a file (photo or document) message.
   */
  async sendFileMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { id } = req.params;
      const file = req.file;
      const messageType = (req.body.message_type || 'document') as 'photo' | 'document';

      if (!file) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'No file uploaded'));
        return;
      }

      const isPhoto = messageType === 'photo' || file.mimetype.startsWith('image/');
      const folder = `schools/${schoolId}/staff-messages`;
      const result = await cloudinaryService.uploadFile(file.buffer, {
        folder,
        resourceType: isPhoto ? 'image' : 'raw',
        accessMode: 'authenticated',
      });

      const message = await staffMessagingService.sendMessage(
        id,
        schoolId,
        userId,
        req.body.content || '',
        isPhoto ? 'photo' : 'document',
        result.publicId,
      );

      res.status(201).json(successResponse(message));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/communication/staff/messages/:id/read
   * Mark a staff message as read.
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId!;
      const userId = req.user!.userId;
      const { id } = req.params;

      const message = await staffMessagingService.markAsRead(id, schoolId, userId);
      res.status(200).json(successResponse(message));
    } catch (error) {
      if (error instanceof CommunicationServiceError) {
        res.status(error.statusCode).json(errorResponse('STAFF_MESSAGING_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
