import { describe, it, expect, vi, beforeEach } from 'vitest';
import { communicationService, CommunicationServiceError } from './communication.service';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    child: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    parentChildLink: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    classroomEnrollment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    message: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    dailyReport: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    dailyReportPhoto: {
      create: vi.fn(),
    },
    classroom: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    announcement: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    event: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    consentForm: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock socket service
vi.mock('../../services/socket.service', () => ({
  socketService: {
    emitToRoom: vi.fn(),
    emitToUser: vi.fn(),
  },
}));

// Mock notification service
vi.mock('../../services/notification.service', () => ({
  notificationService: {
    notifyMany: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock cloudinary service
vi.mock('../../services/cloudinary.service', () => ({
  cloudinaryService: {
    generateSignedUrl: vi.fn((publicId: string, type: string) => {
      const expiry = type === 'photo' ? 3600 : 86400;
      return `https://res.cloudinary.com/demo/image/authenticated/s--mock--/exp_${expiry}/${publicId}`;
    }),
  },
}));

import prisma from '../../lib/prisma';
import { socketService } from '../../services/socket.service';
import { notificationService } from '../../services/notification.service';

const mockPrisma = prisma as unknown as {
  child: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  parentChildLink: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  classroomEnrollment: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  conversation: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  message: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  dailyReport: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  dailyReportPhoto: {
    create: ReturnType<typeof vi.fn>;
  };
  classroom: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  announcement: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  event: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  consentForm: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockNotificationService = notificationService as unknown as {
  notifyMany: ReturnType<typeof vi.fn>;
};

describe('CommunicationService', () => {
  const schoolId = 'school-123';
  const teacherUserId = 'teacher-1';
  const parentUserId = 'parent-1';
  const childId = 'child-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createConversation', () => {
    const input = { childId, parentUserId };

    it('should create a conversation when teacher is assigned to child classroom', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: parentUserId,
        firstName: 'Fatima',
        lastName: 'Ben Ali',
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue({
        id: 'link-1',
        childId,
        parentUserId,
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        childId,
        classroomId: 'classroom-1',
      });
      // No existing conversation
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      mockPrisma.conversation.create.mockResolvedValue({
        id: 'conv-1',
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
        createdAt: new Date(),
        lastMessageAt: new Date(),
        teacher: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
        parent: { id: parentUserId, firstName: 'Fatima', lastName: 'Ben Ali' },
      });

      const result = await communicationService.createConversation(
        schoolId,
        teacherUserId,
        'teacher',
        input,
      );

      expect(result.id).toBe('conv-1');
      expect(result.teacherUserId).toBe(teacherUserId);
      expect(result.parentUserId).toBe(parentUserId);
      expect(result.childId).toBe(childId);
    });

    it('should return existing conversation if one already exists', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: parentUserId,
        firstName: 'Fatima',
        lastName: 'Ben Ali',
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue({
        id: 'link-1',
        childId,
        parentUserId,
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        childId,
        classroomId: 'classroom-1',
      });
      // Existing conversation found
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'existing-conv',
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
        createdAt: new Date(),
        lastMessageAt: new Date(),
        teacher: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
        parent: { id: parentUserId, firstName: 'Fatima', lastName: 'Ben Ali' },
      });

      const result = await communicationService.createConversation(
        schoolId,
        teacherUserId,
        'teacher',
        input,
      );

      expect(result.id).toBe('existing-conv');
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('should throw 404 if child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createConversation(schoolId, teacherUserId, 'teacher', input),
      ).rejects.toThrow(CommunicationServiceError);

      await expect(
        communicationService.createConversation(schoolId, teacherUserId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 404 if parent user not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createConversation(schoolId, teacherUserId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if parent is not linked to child', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: parentUserId,
        firstName: 'Fatima',
        lastName: 'Ben Ali',
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createConversation(schoolId, teacherUserId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 403 if teacher is not assigned to child classroom', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: parentUserId,
        firstName: 'Fatima',
        lastName: 'Ben Ali',
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue({
        id: 'link-1',
        childId,
        parentUserId,
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createConversation(schoolId, teacherUserId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('sendMessage', () => {
    it('should create a text message and emit socket event', async () => {
      const conversationId = 'conv-1';
      const conversation = {
        id: conversationId,
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
      };

      mockPrisma.conversation.findFirst.mockResolvedValue(conversation);

      const createdMessage = {
        id: 'msg-1',
        conversationId,
        senderUserId: teacherUserId,
        content: 'Hello parent!',
        messageType: 'text',
        cloudinaryPublicId: null,
        isRead: false,
        createdAt: new Date(),
        sender: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
      };

      mockPrisma.$transaction.mockResolvedValue([createdMessage, {}]);

      const result = await communicationService.sendMessage(
        conversationId,
        schoolId,
        teacherUserId,
        'teacher',
        { content: 'Hello parent!', messageType: 'text' },
      );

      expect(result.id).toBe('msg-1');
      expect(result.content).toBe('Hello parent!');
      expect(socketService.emitToRoom).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
        'message:new',
        expect.objectContaining({ id: 'msg-1' }),
      );
    });

    it('should generate signed URL for photo messages', async () => {
      const conversationId = 'conv-1';
      const conversation = {
        id: conversationId,
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
      };

      mockPrisma.conversation.findFirst.mockResolvedValue(conversation);

      const createdMessage = {
        id: 'msg-2',
        conversationId,
        senderUserId: parentUserId,
        content: null,
        messageType: 'photo',
        cloudinaryPublicId: 'communication/photos/abc123',
        isRead: false,
        createdAt: new Date(),
        sender: { id: parentUserId, firstName: 'Fatima', lastName: 'Ben Ali' },
      };

      mockPrisma.$transaction.mockResolvedValue([createdMessage, {}]);

      const result = await communicationService.sendMessage(
        conversationId,
        schoolId,
        parentUserId,
        'parent',
        { messageType: 'photo', cloudinaryPublicId: 'communication/photos/abc123' },
      );

      expect(result.mediaUrl).toContain('exp_3600');
      expect(result.mediaUrl).toContain('communication/photos/abc123');
    });

    it('should throw 403 if user is not a participant', async () => {
      const conversationId = 'conv-1';
      const conversation = {
        id: conversationId,
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
      };

      mockPrisma.conversation.findFirst.mockResolvedValue(conversation);

      await expect(
        communicationService.sendMessage(
          conversationId,
          schoolId,
          'other-user',
          'teacher',
          { content: 'Hello', messageType: 'text' },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if conversation not found', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.sendMessage(
          'nonexistent',
          schoolId,
          teacherUserId,
          'teacher',
          { content: 'Hello', messageType: 'text' },
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read and emit socket event', async () => {
      const messageId = 'msg-1';
      const conversationId = 'conv-1';

      mockPrisma.message.findFirst.mockResolvedValue({
        id: messageId,
        conversationId,
        senderUserId: teacherUserId,
        content: 'Hello',
        messageType: 'text',
        cloudinaryPublicId: null,
        isRead: false,
        createdAt: new Date(),
        conversation: {
          id: conversationId,
          schoolId,
          childId,
          teacherUserId,
          parentUserId,
        },
        sender: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
      });

      mockPrisma.message.update.mockResolvedValue({
        id: messageId,
        conversationId,
        senderUserId: teacherUserId,
        content: 'Hello',
        messageType: 'text',
        cloudinaryPublicId: null,
        isRead: true,
        createdAt: new Date(),
        sender: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
      });

      const result = await communicationService.markMessageAsRead(
        messageId,
        schoolId,
        parentUserId,
        'parent',
      );

      expect(result.isRead).toBe(true);
      expect(socketService.emitToRoom).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
        'message:read',
        { messageId, readBy: parentUserId },
      );
    });

    it('should throw 400 if sender tries to mark own message as read', async () => {
      const messageId = 'msg-1';
      const conversationId = 'conv-1';

      mockPrisma.message.findFirst.mockResolvedValue({
        id: messageId,
        conversationId,
        senderUserId: teacherUserId,
        content: 'Hello',
        messageType: 'text',
        cloudinaryPublicId: null,
        isRead: false,
        createdAt: new Date(),
        conversation: {
          id: conversationId,
          schoolId,
          childId,
          teacherUserId,
          parentUserId,
        },
        sender: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
      });

      await expect(
        communicationService.markMessageAsRead(messageId, schoolId, teacherUserId, 'teacher'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 if message not found', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.markMessageAsRead('nonexistent', schoolId, parentUserId, 'parent'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return message as-is if already read', async () => {
      const messageId = 'msg-1';
      const conversationId = 'conv-1';

      mockPrisma.message.findFirst.mockResolvedValue({
        id: messageId,
        conversationId,
        senderUserId: teacherUserId,
        content: 'Hello',
        messageType: 'text',
        cloudinaryPublicId: null,
        isRead: true,
        createdAt: new Date(),
        conversation: {
          id: conversationId,
          schoolId,
          childId,
          teacherUserId,
          parentUserId,
        },
        sender: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
      });

      const result = await communicationService.markMessageAsRead(
        messageId,
        schoolId,
        parentUserId,
        'parent',
      );

      expect(result.isRead).toBe(true);
      expect(mockPrisma.message.update).not.toHaveBeenCalled();
      expect(socketService.emitToRoom).not.toHaveBeenCalled();
    });
  });

  describe('listConversations', () => {
    it('should list conversations for a teacher', async () => {
      const conversations = [
        {
          id: 'conv-1',
          schoolId,
          childId,
          teacherUserId,
          parentUserId,
          createdAt: new Date(),
          lastMessageAt: new Date(),
          teacher: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
          parent: { id: parentUserId, firstName: 'Fatima', lastName: 'Ben Ali' },
        },
      ];

      mockPrisma.conversation.findMany.mockResolvedValue(conversations);
      mockPrisma.conversation.count.mockResolvedValue(1);
      mockPrisma.child.findMany.mockResolvedValue([
        { id: childId, firstName: 'Ahmed', lastName: 'Ben Ali' },
      ]);

      const result = await communicationService.listConversations(
        schoolId,
        teacherUserId,
        'teacher',
        1,
        20,
      );

      expect(result.conversations).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.conversations[0].child.firstName).toBe('Ahmed');
    });
  });

  describe('getMessages', () => {
    it('should return messages with signed URLs for photo messages', async () => {
      const conversationId = 'conv-1';
      const conversation = {
        id: conversationId,
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
      };

      mockPrisma.conversation.findFirst.mockResolvedValue(conversation);

      const messages = [
        {
          id: 'msg-1',
          conversationId,
          senderUserId: teacherUserId,
          content: 'Hello',
          messageType: 'text',
          cloudinaryPublicId: null,
          isRead: true,
          createdAt: new Date(),
          sender: { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
        },
        {
          id: 'msg-2',
          conversationId,
          senderUserId: parentUserId,
          content: null,
          messageType: 'photo',
          cloudinaryPublicId: 'photos/abc',
          isRead: false,
          createdAt: new Date(),
          sender: { id: parentUserId, firstName: 'Fatima', lastName: 'Ben Ali' },
        },
      ];

      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(2);

      const result = await communicationService.getMessages(
        conversationId,
        schoolId,
        teacherUserId,
        'teacher',
        1,
        20,
      );

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].mediaUrl).toBeUndefined();
      expect(result.messages[1].mediaUrl).toContain('exp_3600');
    });
  });

  describe('createDailyReport', () => {
    const reportInput = {
      childId,
      date: '2024-03-15',
      mood: 'happy' as const,
      mealsEaten: 3,
      napDurationMinutes: 90,
      activities: 'Painting and outdoor play',
      generalNote: 'Had a great day!',
    };

    it('should create a daily report and emit to parents', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        childId,
        classroomId: 'classroom-1',
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(null);
      mockPrisma.dailyReport.create.mockResolvedValue({
        id: 'report-1',
        schoolId,
        childId,
        date: new Date('2024-03-15T00:00:00.000Z'),
        mood: 'happy',
        mealsEaten: 3,
        napDurationMinutes: 90,
        activities: 'Painting and outdoor play',
        generalNote: 'Had a great day!',
        createdByUserId: teacherUserId,
        createdAt: new Date(),
        photos: [],
        child: { id: childId, firstName: 'Ahmed', lastName: 'Ben Ali' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: teacherUserId,
        firstName: 'Karim',
        lastName: 'Hadj',
      });
      mockPrisma.parentChildLink.findMany.mockResolvedValue([
        { parentUserId },
      ]);

      const result = await communicationService.createDailyReport(
        schoolId,
        teacherUserId,
        'teacher',
        reportInput,
      );

      expect(result.id).toBe('report-1');
      expect(result.mood).toBe('happy');
      expect(result.mealsEaten).toBe(3);
      expect(result.napDurationMinutes).toBe(90);
      expect(result.child?.firstName).toBe('Ahmed');
      expect(result.createdBy?.firstName).toBe('Karim');
      expect(socketService.emitToUser).toHaveBeenCalledWith(
        parentUserId,
        'report:new',
        expect.objectContaining({ id: 'report-1' }),
      );
    });

    it('should throw 404 if child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createDailyReport(schoolId, teacherUserId, 'teacher', reportInput),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if teacher is not assigned to child classroom', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createDailyReport(schoolId, teacherUserId, 'teacher', reportInput),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 409 if report already exists for child on that date', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        childId,
        classroomId: 'classroom-1',
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        id: 'existing-report',
        childId,
        date: new Date('2024-03-15T00:00:00.000Z'),
      });

      await expect(
        communicationService.createDailyReport(schoolId, teacherUserId, 'teacher', reportInput),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('getDailyReportsForChild', () => {
    it('should return paginated reports for a child (teacher access)', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        childId,
        classroomId: 'classroom-1',
      });

      const reports = [
        {
          id: 'report-1',
          schoolId,
          childId,
          date: new Date('2024-03-15T00:00:00.000Z'),
          mood: 'happy',
          mealsEaten: 3,
          napDurationMinutes: 90,
          activities: 'Painting',
          generalNote: null,
          createdByUserId: teacherUserId,
          createdAt: new Date(),
          photos: [
            {
              id: 'photo-1',
              dailyReportId: 'report-1',
              cloudinaryPublicId: 'reports/photo1',
              createdAt: new Date(),
            },
          ],
          child: { id: childId, firstName: 'Ahmed', lastName: 'Ben Ali' },
        },
      ];

      mockPrisma.dailyReport.findMany.mockResolvedValue(reports);
      mockPrisma.dailyReport.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: teacherUserId, firstName: 'Karim', lastName: 'Hadj' },
      ]);

      const result = await communicationService.getDailyReportsForChild(
        childId,
        schoolId,
        teacherUserId,
        'teacher',
        1,
        20,
      );

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.reports[0].photos).toHaveLength(1);
      expect(result.reports[0].photos[0].photoUrl).toContain('exp_3600');
    });

    it('should throw 403 if parent is not linked to child', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({
        id: childId,
        firstName: 'Ahmed',
        lastName: 'Ben Ali',
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.getDailyReportsForChild(
          childId,
          schoolId,
          'other-parent',
          'parent',
          1,
          20,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getDailyReportById', () => {
    it('should return a single report with photos', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue({
        id: 'report-1',
        schoolId,
        childId,
        date: new Date('2024-03-15T00:00:00.000Z'),
        mood: 'happy',
        mealsEaten: 3,
        napDurationMinutes: 90,
        activities: 'Painting',
        generalNote: null,
        createdByUserId: teacherUserId,
        createdAt: new Date(),
        photos: [],
        child: { id: childId, firstName: 'Ahmed', lastName: 'Ben Ali' },
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: teacherUserId,
        firstName: 'Karim',
        lastName: 'Hadj',
      });

      const result = await communicationService.getDailyReportById(
        'report-1',
        schoolId,
        teacherUserId,
        'teacher',
      );

      expect(result.id).toBe('report-1');
      expect(result.mood).toBe('happy');
      expect(result.createdBy?.firstName).toBe('Karim');
    });

    it('should throw 404 if report not found', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.getDailyReportById('nonexistent', schoolId, teacherUserId, 'teacher'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('uploadDailyReportPhoto', () => {
    it('should upload a photo to an existing report', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue({
        id: 'report-1',
        schoolId,
        childId,
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
      });
      mockPrisma.dailyReportPhoto.create.mockResolvedValue({
        id: 'photo-1',
        dailyReportId: 'report-1',
        cloudinaryPublicId: 'daily-reports/photo123',
        createdAt: new Date(),
      });

      const result = await communicationService.uploadDailyReportPhoto(
        'report-1',
        schoolId,
        teacherUserId,
        'teacher',
        { cloudinaryPublicId: 'daily-reports/photo123' },
      );

      expect(result.id).toBe('photo-1');
      expect(result.photoUrl).toContain('daily-reports/photo123');
      expect(result.photoUrl).toContain('exp_3600');
    });

    it('should throw 404 if report not found', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.uploadDailyReportPhoto(
          'nonexistent',
          schoolId,
          teacherUserId,
          'teacher',
          { cloudinaryPublicId: 'daily-reports/photo123' },
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if teacher is not assigned to child classroom', async () => {
      mockPrisma.dailyReport.findFirst.mockResolvedValue({
        id: 'report-1',
        schoolId,
        childId,
      });
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.uploadDailyReportPhoto(
          'report-1',
          schoolId,
          teacherUserId,
          'teacher',
          { cloudinaryPublicId: 'daily-reports/photo123' },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('createAnnouncement', () => {
    const adminUserId = 'admin-1';

    it('should create a school-wide announcement and emit to school room', async () => {
      const input = { title: 'School Closed', content: 'School will be closed tomorrow.', classroomId: null };

      mockPrisma.announcement.create.mockResolvedValue({
        id: 'ann-1',
        schoolId,
        classroomId: null,
        title: 'School Closed',
        content: 'School will be closed tomorrow.',
        createdByUserId: adminUserId,
        publishedAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: adminUserId,
        firstName: 'Admin',
        lastName: 'User',
      });
      mockPrisma.user.findMany.mockResolvedValue([
        { id: teacherUserId },
        { id: parentUserId },
      ]);

      const result = await communicationService.createAnnouncement(schoolId, adminUserId, input);

      expect(result.id).toBe('ann-1');
      expect(result.title).toBe('School Closed');
      expect(result.classroomId).toBeNull();
      expect(result.publishedAt).not.toBeNull();
      expect(result.createdBy?.firstName).toBe('Admin');
      expect(socketService.emitToRoom).toHaveBeenCalledWith(
        `school:${schoolId}`,
        'announcement:new',
        expect.objectContaining({ id: 'ann-1' }),
      );
    });

    it('should create a classroom-specific announcement and emit to classroom room', async () => {
      const classroomId = 'classroom-1';
      const input = { title: 'Field Trip', content: 'We are going on a field trip.', classroomId };

      mockPrisma.classroom.findFirst.mockResolvedValue({
        id: classroomId,
        schoolId,
        teacherUserId,
      });
      mockPrisma.announcement.create.mockResolvedValue({
        id: 'ann-2',
        schoolId,
        classroomId,
        title: 'Field Trip',
        content: 'We are going on a field trip.',
        createdByUserId: adminUserId,
        publishedAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: adminUserId,
        firstName: 'Admin',
        lastName: 'User',
      });
      mockPrisma.classroom.findUnique.mockResolvedValue({
        id: classroomId,
        teacherUserId,
      });
      mockPrisma.classroomEnrollment.findMany.mockResolvedValue([
        { childId },
      ]);
      mockPrisma.parentChildLink.findMany.mockResolvedValue([
        { parentUserId },
      ]);

      const result = await communicationService.createAnnouncement(schoolId, adminUserId, input);

      expect(result.id).toBe('ann-2');
      expect(result.classroomId).toBe(classroomId);
      expect(socketService.emitToRoom).toHaveBeenCalledWith(
        `classroom:${classroomId}`,
        'announcement:new',
        expect.objectContaining({ id: 'ann-2' }),
      );
    });

    it('should throw 404 if classroom not found', async () => {
      const input = { title: 'Test', content: 'Test content', classroomId: 'nonexistent' };

      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.createAnnouncement(schoolId, adminUserId, input),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should send push notifications to targeted users', async () => {
      const input = { title: 'Important', content: 'Important announcement.', classroomId: null };

      mockPrisma.announcement.create.mockResolvedValue({
        id: 'ann-3',
        schoolId,
        classroomId: null,
        title: 'Important',
        content: 'Important announcement.',
        createdByUserId: adminUserId,
        publishedAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: adminUserId,
        firstName: 'Admin',
        lastName: 'User',
      });
      mockPrisma.user.findMany.mockResolvedValue([
        { id: teacherUserId },
        { id: parentUserId },
      ]);

      await communicationService.createAnnouncement(schoolId, adminUserId, input);

      // Wait for async notification dispatch
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockNotificationService.notifyMany).toHaveBeenCalledWith(
        [teacherUserId, parentUserId],
        expect.objectContaining({
          title: 'Important',
          type: 'announcement',
          channels: ['push', 'email'],
        }),
      );
    });
  });

  describe('listAnnouncements', () => {
    it('should return paginated announcements for a school', async () => {
      const announcements = [
        {
          id: 'ann-1',
          schoolId,
          classroomId: null,
          title: 'School Closed',
          content: 'School will be closed.',
          createdByUserId: 'admin-1',
          publishedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockPrisma.announcement.findMany.mockResolvedValue(announcements);
      mockPrisma.announcement.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1', firstName: 'Admin', lastName: 'User' },
      ]);

      const result = await communicationService.listAnnouncements(schoolId, 1, 20);

      expect(result.announcements).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.announcements[0].title).toBe('School Closed');
      expect(result.announcements[0].createdBy?.firstName).toBe('Admin');
    });

    it('should filter by classroomId and include school-wide announcements', async () => {
      const classroomId = 'classroom-1';

      mockPrisma.announcement.findMany.mockResolvedValue([]);
      mockPrisma.announcement.count.mockResolvedValue(0);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await communicationService.listAnnouncements(schoolId, 1, 20, classroomId);

      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId,
            OR: [{ classroomId }, { classroomId: null }],
          }),
        }),
      );
    });
  });

  describe('getAnnouncementById', () => {
    it('should return a single announcement', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue({
        id: 'ann-1',
        schoolId,
        classroomId: null,
        title: 'Test Announcement',
        content: 'Test content',
        createdByUserId: 'admin-1',
        publishedAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        firstName: 'Admin',
        lastName: 'User',
      });

      const result = await communicationService.getAnnouncementById('ann-1', schoolId);

      expect(result.id).toBe('ann-1');
      expect(result.title).toBe('Test Announcement');
      expect(result.createdBy?.firstName).toBe('Admin');
    });

    it('should throw 404 if announcement not found', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.getAnnouncementById('nonexistent', schoolId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── Events & Consent Forms ──────────────────────────────────────────────────

  describe('createEvent', () => {
    const adminUserId = 'admin-1';

    it('should create an event without consent forms when requiresConsent is false', async () => {
      const input = {
        title: 'Parent Meeting',
        description: 'Monthly parent meeting',
        startDatetime: '2024-06-20T14:00:00.000Z',
        endDatetime: '2024-06-20T16:00:00.000Z',
        location: 'School Hall',
        requiresConsent: false,
      };

      mockPrisma.event.create.mockResolvedValue({
        id: 'event-1',
        schoolId,
        title: input.title,
        description: input.description,
        startDatetime: new Date(input.startDatetime),
        endDatetime: new Date(input.endDatetime!),
        location: input.location,
        requiresConsent: false,
        createdByUserId: adminUserId,
        createdAt: new Date(),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: adminUserId,
        firstName: 'Admin',
        lastName: 'User',
      });

      const result = await communicationService.createEvent(schoolId, adminUserId, input);

      expect(result.id).toBe('event-1');
      expect(result.title).toBe('Parent Meeting');
      expect(result.requiresConsent).toBe(false);
      expect(result.consentForms).toEqual([]);
      expect(mockPrisma.child.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.consentForm.createMany).not.toHaveBeenCalled();
    });

    it('should create an event and generate consent forms when requiresConsent is true', async () => {
      const input = {
        title: 'Field Trip',
        description: 'Trip to the zoo',
        startDatetime: '2024-06-15T09:00:00.000Z',
        endDatetime: null,
        location: 'City Zoo',
        requiresConsent: true,
      };

      mockPrisma.event.create.mockResolvedValue({
        id: 'event-2',
        schoolId,
        title: input.title,
        description: input.description,
        startDatetime: new Date(input.startDatetime),
        endDatetime: null,
        location: input.location,
        requiresConsent: true,
        createdByUserId: adminUserId,
        createdAt: new Date(),
      });
      mockPrisma.child.findMany.mockResolvedValue([
        { id: 'child-1', firstName: 'Ahmed', lastName: 'Ben Ali' },
        { id: 'child-2', firstName: 'Sara', lastName: 'Boudiaf' },
      ]);
      mockPrisma.consentForm.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.consentForm.findMany.mockResolvedValue([
        {
          id: 'cf-1',
          eventId: 'event-2',
          childId: 'child-1',
          status: 'pending',
          respondedAt: null,
          createdAt: new Date(),
          child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ben Ali' },
        },
        {
          id: 'cf-2',
          eventId: 'event-2',
          childId: 'child-2',
          status: 'pending',
          respondedAt: null,
          createdAt: new Date(),
          child: { id: 'child-2', firstName: 'Sara', lastName: 'Boudiaf' },
        },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: adminUserId,
        firstName: 'Admin',
        lastName: 'User',
      });

      const result = await communicationService.createEvent(schoolId, adminUserId, input);

      expect(result.id).toBe('event-2');
      expect(result.requiresConsent).toBe(true);
      expect(result.consentForms).toHaveLength(2);
      expect(result.consentForms![0].status).toBe('pending');
      expect(result.consentForms![1].childId).toBe('child-2');
      expect(mockPrisma.consentForm.createMany).toHaveBeenCalledWith({
        data: [
          { eventId: 'event-2', childId: 'child-1' },
          { eventId: 'event-2', childId: 'child-2' },
        ],
      });
    });

    it('should create event with no consent forms when no active children exist', async () => {
      const input = {
        title: 'Trip',
        description: null,
        startDatetime: '2024-06-15T09:00:00.000Z',
        endDatetime: null,
        location: null,
        requiresConsent: true,
      };

      mockPrisma.event.create.mockResolvedValue({
        id: 'event-3',
        schoolId,
        title: input.title,
        description: null,
        startDatetime: new Date(input.startDatetime),
        endDatetime: null,
        location: null,
        requiresConsent: true,
        createdByUserId: adminUserId,
        createdAt: new Date(),
      });
      mockPrisma.child.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: adminUserId,
        firstName: 'Admin',
        lastName: 'User',
      });

      const result = await communicationService.createEvent(schoolId, adminUserId, input);

      expect(result.consentForms).toEqual([]);
      expect(mockPrisma.consentForm.createMany).not.toHaveBeenCalled();
    });
  });

  describe('listEvents', () => {
    it('should return paginated events for a school', async () => {
      const events = [
        {
          id: 'event-1',
          schoolId,
          title: 'Field Trip',
          description: 'Trip to zoo',
          startDatetime: new Date('2024-06-15T09:00:00.000Z'),
          endDatetime: new Date('2024-06-15T15:00:00.000Z'),
          location: 'City Zoo',
          requiresConsent: true,
          createdByUserId: 'admin-1',
          createdAt: new Date(),
        },
      ];

      mockPrisma.event.findMany.mockResolvedValue(events);
      mockPrisma.event.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1', firstName: 'Admin', lastName: 'User' },
      ]);

      const result = await communicationService.listEvents(schoolId, 1, 20);

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.events[0].title).toBe('Field Trip');
      expect(result.events[0].createdBy?.firstName).toBe('Admin');
    });
  });

  describe('getEventById', () => {
    it('should return event with consent forms', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        schoolId,
        title: 'Field Trip',
        description: 'Trip to zoo',
        startDatetime: new Date('2024-06-15T09:00:00.000Z'),
        endDatetime: null,
        location: 'City Zoo',
        requiresConsent: true,
        createdByUserId: 'admin-1',
        createdAt: new Date(),
        consentForms: [
          {
            id: 'cf-1',
            eventId: 'event-1',
            childId: 'child-1',
            status: 'pending',
            respondedAt: null,
            createdAt: new Date(),
            child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ben Ali' },
          },
        ],
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        firstName: 'Admin',
        lastName: 'User',
      });

      const result = await communicationService.getEventById('event-1', schoolId);

      expect(result.id).toBe('event-1');
      expect(result.consentForms).toHaveLength(1);
      expect(result.consentForms![0].status).toBe('pending');
      expect(result.consentForms![0].child?.firstName).toBe('Ahmed');
    });

    it('should throw 404 if event not found', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.getEventById('nonexistent', schoolId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('respondToConsent', () => {
    it('should update consent form status to approved', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        schoolId,
        requiresConsent: true,
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue({
        id: 'link-1',
        childId,
        parentUserId,
      });
      mockPrisma.consentForm.findUnique.mockResolvedValue({
        id: 'cf-1',
        eventId: 'event-1',
        childId,
        status: 'pending',
        respondedAt: null,
        createdAt: new Date(),
      });
      const respondedAt = new Date();
      mockPrisma.consentForm.update.mockResolvedValue({
        id: 'cf-1',
        eventId: 'event-1',
        childId,
        status: 'approved',
        respondedAt,
        createdAt: new Date(),
        child: { id: childId, firstName: 'Ahmed', lastName: 'Ben Ali' },
      });

      const result = await communicationService.respondToConsent(
        'event-1',
        childId,
        schoolId,
        parentUserId,
        { status: 'approved' },
      );

      expect(result.status).toBe('approved');
      expect(result.respondedAt).toBe(respondedAt);
      expect(mockPrisma.consentForm.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            respondedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should update consent form status to declined', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        schoolId,
        requiresConsent: true,
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue({
        id: 'link-1',
        childId,
        parentUserId,
      });
      mockPrisma.consentForm.findUnique.mockResolvedValue({
        id: 'cf-1',
        eventId: 'event-1',
        childId,
        status: 'pending',
        respondedAt: null,
        createdAt: new Date(),
      });
      mockPrisma.consentForm.update.mockResolvedValue({
        id: 'cf-1',
        eventId: 'event-1',
        childId,
        status: 'declined',
        respondedAt: new Date(),
        createdAt: new Date(),
        child: { id: childId, firstName: 'Ahmed', lastName: 'Ben Ali' },
      });

      const result = await communicationService.respondToConsent(
        'event-1',
        childId,
        schoolId,
        parentUserId,
        { status: 'declined' },
      );

      expect(result.status).toBe('declined');
    });

    it('should throw 404 if event not found', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.respondToConsent('nonexistent', childId, schoolId, parentUserId, { status: 'approved' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if parent is not linked to child', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        schoolId,
        requiresConsent: true,
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        communicationService.respondToConsent('event-1', childId, schoolId, parentUserId, { status: 'approved' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if consent form not found', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        schoolId,
        requiresConsent: true,
      });
      mockPrisma.parentChildLink.findFirst.mockResolvedValue({
        id: 'link-1',
        childId,
        parentUserId,
      });
      mockPrisma.consentForm.findUnique.mockResolvedValue(null);

      await expect(
        communicationService.respondToConsent('event-1', childId, schoolId, parentUserId, { status: 'approved' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
