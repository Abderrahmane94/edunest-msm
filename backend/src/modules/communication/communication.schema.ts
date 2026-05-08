import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../utils/validators';

// ─── Daily Reports Schemas ───────────────────────────────────────────────────

/**
 * Schema for creating a daily report for a child.
 * Enforces mood enum values and required fields.
 */
export const createDailyReportSchema = z.object({
  childId: uuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mood: z.enum(['happy', 'sad', 'tired', 'excited', 'calm'], {
    errorMap: () => ({ message: 'Mood must be one of: happy, sad, tired, excited, calm' }),
  }),
  mealsEaten: z.number().int().min(0, 'Meals eaten must be a non-negative integer').max(10, 'Meals eaten must not exceed 10'),
  napDurationMinutes: z.number().int().min(0, 'Nap duration must be a non-negative integer').max(480, 'Nap duration must not exceed 480 minutes').optional().nullable(),
  activities: z.string().max(2000, 'Activities must not exceed 2000 characters').optional().nullable(),
  generalNote: z.string().max(2000, 'General note must not exceed 2000 characters').optional().nullable(),
});

/**
 * Schema for child ID route parameter (for daily reports).
 */
export const childIdParamSchema = z.object({
  childId: uuidSchema,
});

/**
 * Schema for daily report ID route parameter.
 */
export const dailyReportIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for uploading a photo to a daily report.
 */
export const uploadDailyReportPhotoSchema = z.object({
  cloudinaryPublicId: z.string().min(1, 'Cloudinary public ID is required').max(500, 'Cloudinary public ID must not exceed 500 characters'),
});

/**
 * Schema for daily reports query params (pagination + optional date filter).
 */
export const dailyReportsQuerySchema = paginationSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// ─── Daily Reports Type Exports ──────────────────────────────────────────────

export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>;
export type UploadDailyReportPhotoInput = z.infer<typeof uploadDailyReportPhotoSchema>;
export type DailyReportsQuery = z.infer<typeof dailyReportsQuerySchema>;

/**
 * Schema for creating a new conversation.
 * Conversations are scoped to a specific child (one teacher + one parent).
 */
export const createConversationSchema = z.object({
  childId: uuidSchema,
  parentUserId: uuidSchema,
});

/**
 * Schema for sending a message in a conversation.
 * Supports text, photo, and document message types.
 * - text: content is required, cloudinaryPublicId is not allowed
 * - photo/document: cloudinaryPublicId is required, content is optional (caption)
 */
export const sendMessageSchema = z
  .object({
    content: z.string().max(5000, 'Message content must not exceed 5000 characters').optional(),
    messageType: z.enum(['text', 'photo', 'document'], {
      errorMap: () => ({ message: 'Message type must be one of: text, photo, document' }),
    }),
    cloudinaryPublicId: z.string().max(500, 'Cloudinary public ID must not exceed 500 characters').optional(),
  })
  .refine(
    (data) => {
      if (data.messageType === 'text') {
        return !!data.content && data.content.trim().length > 0;
      }
      return true;
    },
    { message: 'Content is required for text messages', path: ['content'] },
  )
  .refine(
    (data) => {
      if (data.messageType === 'photo' || data.messageType === 'document') {
        return !!data.cloudinaryPublicId;
      }
      return true;
    },
    { message: 'Cloudinary public ID is required for photo and document messages', path: ['cloudinaryPublicId'] },
  );

/**
 * Schema for conversation ID route parameter.
 */
export const conversationIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for message ID route parameter (for read receipts).
 */
export const messageIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for messages query params (pagination).
 */
export const messagesQuerySchema = paginationSchema;

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

// ─── Announcements Schemas ───────────────────────────────────────────────────

/**
 * Schema for creating a new announcement.
 * If classroomId is provided, the announcement targets that classroom only.
 * If classroomId is omitted/null, the announcement targets the entire school.
 */
export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must not exceed 200 characters'),
  content: z.string().min(1, 'Content is required').max(5000, 'Content must not exceed 5000 characters'),
  classroomId: uuidSchema.optional().nullable(),
});

/**
 * Schema for announcement ID route parameter.
 */
export const announcementIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for announcements query params (pagination + optional classroomId filter).
 */
export const announcementsQuerySchema = paginationSchema.extend({
  classroomId: uuidSchema.optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type AnnouncementsQuery = z.infer<typeof announcementsQuerySchema>;

// ─── Events & Consent Forms Schemas ──────────────────────────────────────────

/**
 * Schema for creating a new event.
 * Only admins can create events.
 * When requires_consent is true, ConsentForm records are generated for each active child in the school.
 */
export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must not exceed 200 characters'),
  description: z.string().max(5000, 'Description must not exceed 5000 characters').optional().nullable(),
  startDatetime: z.string().datetime({ message: 'start_datetime must be a valid ISO 8601 datetime' }),
  endDatetime: z.string().datetime({ message: 'end_datetime must be a valid ISO 8601 datetime' }).optional().nullable(),
  location: z.string().max(500, 'Location must not exceed 500 characters').optional().nullable(),
  requiresConsent: z.boolean().optional().default(false),
});

/**
 * Schema for event ID route parameter.
 */
export const eventIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for consent response route parameters (eventId + childId).
 */
export const consentResponseParamSchema = z.object({
  eventId: uuidSchema,
  childId: uuidSchema,
});

/**
 * Schema for responding to a consent form.
 * Parents can approve or decline consent for their linked children.
 */
export const respondConsentSchema = z.object({
  status: z.enum(['approved', 'declined'], {
    errorMap: () => ({ message: 'Status must be one of: approved, declined' }),
  }),
});

/**
 * Schema for events query params (pagination).
 */
export const eventsQuerySchema = paginationSchema;

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RespondConsentInput = z.infer<typeof respondConsentSchema>;
export type EventsQuery = z.infer<typeof eventsQuerySchema>;
