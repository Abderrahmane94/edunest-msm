import { describe, it, expect } from 'vitest';
import {
  createConversationSchema,
  sendMessageSchema,
  conversationIdParamSchema,
  messageIdParamSchema,
  createDailyReportSchema,
  childIdParamSchema,
  dailyReportIdParamSchema,
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

describe('Communication Schemas', () => {
  describe('createConversationSchema', () => {
    it('should accept valid input', () => {
      const input = {
        childId: '550e8400-e29b-41d4-a716-446655440000',
        parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      };
      const result = createConversationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid childId', () => {
      const input = {
        childId: 'not-a-uuid',
        parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      };
      const result = createConversationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept missing parentUserId (optional field)', () => {
      const input = {
        childId: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = createConversationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('sendMessageSchema', () => {
    it('should accept valid text message', () => {
      const input = {
        content: 'Hello, how is my child doing?',
        messageType: 'text',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject text message without content', () => {
      const input = {
        messageType: 'text',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject text message with empty content', () => {
      const input = {
        content: '   ',
        messageType: 'text',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept valid photo message with cloudinaryPublicId', () => {
      const input = {
        messageType: 'photo',
        cloudinaryPublicId: 'communication/photos/abc123',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept photo message with optional content (caption)', () => {
      const input = {
        content: 'Look at this!',
        messageType: 'photo',
        cloudinaryPublicId: 'communication/photos/abc123',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject photo message without cloudinaryPublicId', () => {
      const input = {
        messageType: 'photo',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept valid document message', () => {
      const input = {
        messageType: 'document',
        cloudinaryPublicId: 'communication/docs/report.pdf',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject document message without cloudinaryPublicId', () => {
      const input = {
        messageType: 'document',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid messageType', () => {
      const input = {
        content: 'Hello',
        messageType: 'video',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject content exceeding 5000 characters', () => {
      const input = {
        content: 'a'.repeat(5001),
        messageType: 'text',
      };
      const result = sendMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('conversationIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = conversationIdParamSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = conversationIdParamSchema.safeParse({
        id: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('messageIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = messageIdParamSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = messageIdParamSchema.safeParse({
        id: '123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createDailyReportSchema', () => {
    const validInput = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      date: '2024-03-15',
      mood: 'happy',
      mealsEaten: 3,
      napDurationMinutes: 90,
      activities: 'Painting and outdoor play',
      generalNote: 'Had a great day!',
    };

    it('should accept valid input with all fields', () => {
      const result = createDailyReportSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept valid input with only required fields', () => {
      const input = {
        childId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-03-15',
        mood: 'calm',
        mealsEaten: 2,
      };
      const result = createDailyReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid mood values', () => {
      const moods = ['happy', 'sad', 'tired', 'excited', 'calm'];
      for (const mood of moods) {
        const result = createDailyReportSchema.safeParse({ ...validInput, mood });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid mood value', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, mood: 'angry' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, date: '15-03-2024' });
      expect(result.success).toBe(false);
    });

    it('should reject negative mealsEaten', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, mealsEaten: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject mealsEaten exceeding 10', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, mealsEaten: 11 });
      expect(result.success).toBe(false);
    });

    it('should reject negative napDurationMinutes', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, napDurationMinutes: -5 });
      expect(result.success).toBe(false);
    });

    it('should reject napDurationMinutes exceeding 480', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, napDurationMinutes: 500 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid childId', () => {
      const result = createDailyReportSchema.safeParse({ ...validInput, childId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('childIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = childIdParamSchema.safeParse({
        childId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = childIdParamSchema.safeParse({
        childId: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dailyReportIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = dailyReportIdParamSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = dailyReportIdParamSchema.safeParse({
        id: 'bad-id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dailyReportsQuerySchema', () => {
    it('should accept valid pagination with date filter', () => {
      const result = dailyReportsQuerySchema.safeParse({
        page: '1',
        pageSize: '10',
        date: '2024-03-15',
      });
      expect(result.success).toBe(true);
    });

    it('should accept pagination without date filter', () => {
      const result = dailyReportsQuerySchema.safeParse({
        page: '1',
        pageSize: '20',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format in query', () => {
      const result = dailyReportsQuerySchema.safeParse({
        page: '1',
        pageSize: '20',
        date: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createAnnouncementSchema', () => {
    it('should accept valid input with classroomId', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Field Trip',
        content: 'We are going on a field trip next week.',
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid input without classroomId (school-wide)', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'School Closed',
        content: 'School will be closed tomorrow due to weather.',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null classroomId (school-wide)', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'School Closed',
        content: 'School will be closed tomorrow.',
        classroomId: null,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = createAnnouncementSchema.safeParse({
        title: '',
        content: 'Some content',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Title',
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject title exceeding 200 characters', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'a'.repeat(201),
        content: 'Some content',
      });
      expect(result.success).toBe(false);
    });

    it('should reject content exceeding 5000 characters', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Title',
        content: 'a'.repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid classroomId format', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Title',
        content: 'Content',
        classroomId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('announcementIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = announcementIdParamSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = announcementIdParamSchema.safeParse({
        id: 'bad-id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('announcementsQuerySchema', () => {
    it('should accept valid pagination', () => {
      const result = announcementsQuerySchema.safeParse({
        page: '1',
        pageSize: '20',
      });
      expect(result.success).toBe(true);
    });

    it('should accept pagination with classroomId filter', () => {
      const result = announcementsQuerySchema.safeParse({
        page: '1',
        pageSize: '10',
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid classroomId in query', () => {
      const result = announcementsQuerySchema.safeParse({
        page: '1',
        pageSize: '20',
        classroomId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── Events & Consent Forms Schemas ──────────────────────────────────────────

  describe('createEventSchema', () => {
    it('should accept valid event with all fields', () => {
      const result = createEventSchema.safeParse({
        title: 'Field Trip to Zoo',
        description: 'Annual field trip for all children',
        startDatetime: '2024-06-15T09:00:00.000Z',
        endDatetime: '2024-06-15T15:00:00.000Z',
        location: 'City Zoo',
        requiresConsent: true,
      });
      expect(result.success).toBe(true);
    });

    it('should accept event with only required fields', () => {
      const result = createEventSchema.safeParse({
        title: 'Parent Meeting',
        startDatetime: '2024-06-20T14:00:00.000Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresConsent).toBe(false);
      }
    });

    it('should reject missing title', () => {
      const result = createEventSchema.safeParse({
        startDatetime: '2024-06-15T09:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const result = createEventSchema.safeParse({
        title: '',
        startDatetime: '2024-06-15T09:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('should reject title exceeding 200 characters', () => {
      const result = createEventSchema.safeParse({
        title: 'A'.repeat(201),
        startDatetime: '2024-06-15T09:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid startDatetime format', () => {
      const result = createEventSchema.safeParse({
        title: 'Event',
        startDatetime: '2024-06-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing startDatetime', () => {
      const result = createEventSchema.safeParse({
        title: 'Event',
      });
      expect(result.success).toBe(false);
    });

    it('should accept null optional fields', () => {
      const result = createEventSchema.safeParse({
        title: 'Event',
        startDatetime: '2024-06-15T09:00:00.000Z',
        description: null,
        endDatetime: null,
        location: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('eventIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = eventIdParamSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = eventIdParamSchema.safeParse({
        id: 'bad-id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('consentResponseParamSchema', () => {
    it('should accept valid eventId and childId', () => {
      const result = consentResponseParamSchema.safeParse({
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        childId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid eventId', () => {
      const result = consentResponseParamSchema.safeParse({
        eventId: 'bad-id',
        childId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid childId', () => {
      const result = consentResponseParamSchema.safeParse({
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        childId: 'bad-id',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('respondConsentSchema', () => {
    it('should accept approved status', () => {
      const result = respondConsentSchema.safeParse({ status: 'approved' });
      expect(result.success).toBe(true);
    });

    it('should accept declined status', () => {
      const result = respondConsentSchema.safeParse({ status: 'declined' });
      expect(result.success).toBe(true);
    });

    it('should reject pending status (parents cannot set pending)', () => {
      const result = respondConsentSchema.safeParse({ status: 'pending' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const result = respondConsentSchema.safeParse({ status: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject missing status', () => {
      const result = respondConsentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('eventsQuerySchema', () => {
    it('should accept valid pagination', () => {
      const result = eventsQuerySchema.safeParse({
        page: '1',
        pageSize: '20',
      });
      expect(result.success).toBe(true);
    });

    it('should use defaults when no params provided', () => {
      const result = eventsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });
  });
});
