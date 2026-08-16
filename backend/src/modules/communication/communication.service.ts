import prisma from '../../lib/prisma';
import { socketService } from '../../services/socket.service';
import { notificationService } from '../../services/notification.service';
import { cloudinaryService } from '../../services/cloudinary.service';
import type { CreateConversationInput, SendMessageInput, CreateDailyReportInput, UploadDailyReportPhotoInput, CreateAnnouncementInput, CreateEventInput, RespondConsentInput } from './communication.schema';
import type {
  ConversationWithParticipants,
  MessageResponse,
  DailyReportResponse,
  DailyReportPhotoResponse,
  AnnouncementResponse,
  EventResponse,
  ConsentFormResponse,
} from './communication.types';

export class CommunicationServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'CommunicationServiceError';
  }
}

const participantSelect = {
  id: true,
  firstName: true,
  lastName: true,
};

class CommunicationService {
  /**
   * Create a conversation scoped to a specific child (one teacher + one parent).
   * Only teachers and admins can create conversations.
   * Teachers can only create conversations with parents of children in their classroom.
   */
  async createConversation(
    schoolId: string,
    userId: string,
    userRole: string,
    input: CreateConversationInput,
  ): Promise<ConversationWithParticipants> {
    const { childId } = input;
    let { parentUserId } = input;

    // Verify the child belongs to this school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!child) {
      throw new CommunicationServiceError('Child not found or does not belong to this school', 404);
    }

    // If parentUserId not provided, auto-resolve from child's primary parent link
    if (!parentUserId) {
      const primaryLink = await prisma.parentChildLink.findFirst({
        where: { childId, isPrimary: true },
        select: { parentUserId: true },
      });

      if (!primaryLink) {
        // Fallback to any linked parent
        const anyLink = await prisma.parentChildLink.findFirst({
          where: { childId },
          select: { parentUserId: true },
        });

        if (!anyLink) {
          throw new CommunicationServiceError('No parent is linked to this child', 400);
        }
        parentUserId = anyLink.parentUserId;
      } else {
        parentUserId = primaryLink.parentUserId;
      }
    }

    // Verify the parent user exists, belongs to this school, and has parent role
    const parentUser = await prisma.user.findFirst({
      where: { id: parentUserId, schoolId, role: 'parent', isActive: true },
      select: participantSelect,
    });

    if (!parentUser) {
      throw new CommunicationServiceError('Parent user not found or is not a parent in this school', 404);
    }

    // Verify the parent is linked to this child
    const parentLink = await prisma.parentChildLink.findFirst({
      where: { childId, parentUserId },
    });

    if (!parentLink) {
      throw new CommunicationServiceError('The specified parent is not linked to this child', 400);
    }

    // Determine the teacher user ID
    let teacherUserId = userId;

    if (userRole === 'teacher') {
      // Verify the teacher is assigned to a classroom where this child is enrolled
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });

      if (!enrollment) {
        throw new CommunicationServiceError(
          'You can only create conversations with parents of children in your classroom',
          403,
        );
      }
    } else if (userRole === 'admin' || userRole === 'super_admin') {
      // Admins can create conversations — find the teacher assigned to the child's classroom
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: { childId, classroom: { schoolId } },
        include: { classroom: true },
      });

      if (!enrollment || !enrollment.classroom.teacherUserId) {
        throw new CommunicationServiceError(
          'No teacher is assigned to this child\'s classroom',
          400,
        );
      }

      teacherUserId = enrollment.classroom.teacherUserId;
    }

    // Check if a conversation already exists for this teacher + parent + child
    const existingConversation = await prisma.conversation.findFirst({
      where: { childId, teacherUserId, parentUserId, schoolId },
      include: {
        teacher: { select: participantSelect },
        parent: { select: participantSelect },
      },
    });

    if (existingConversation) {
      return {
        ...existingConversation,
        child,
      };
    }

    // Create the conversation
    const conversation = await prisma.conversation.create({
      data: {
        schoolId,
        childId,
        teacherUserId,
        parentUserId,
        lastMessageAt: new Date(),
      },
      include: {
        teacher: { select: participantSelect },
        parent: { select: participantSelect },
      },
    });

    return {
      ...conversation,
      child,
    };
  }

  /**
   * List conversations for the current user.
   * Teachers see conversations where they are the teacher.
   * Parents see conversations where they are the parent.
   * Admins see all conversations in their school.
   */
  async listConversations(
    schoolId: string,
    userId: string,
    userRole: string,
    page: number,
    pageSize: number,
  ): Promise<{ conversations: ConversationWithParticipants[]; total: number }> {
    const where: Record<string, unknown> = { schoolId };

    if (userRole === 'teacher') {
      where.teacherUserId = userId;
    } else if (userRole === 'parent') {
      where.parentUserId = userId;
    }
    // admin/super_admin see all conversations in the school

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          teacher: { select: participantSelect },
          parent: { select: participantSelect },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Fetch child info for each conversation
    const childIds = conversations.map((c) => c.childId);
    const children = await prisma.child.findMany({
      where: { id: { in: childIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const childMap = new Map(children.map((c) => [c.id, c]));

    const conversationsWithChildren = conversations.map((conv) => ({
      ...conv,
      child: childMap.get(conv.childId) || { id: conv.childId, firstName: '', lastName: '' },
    }));

    return { conversations: conversationsWithChildren, total };
  }

  /**
   * List conversations where the teacher hasn't responded to a parent message
   * in more than 3 hours. Returns metadata without message content for privacy.
   */
  async listPendingConversations(
    schoolId: string,
  ): Promise<{ conversations: Array<ConversationWithParticipants & { unreadCount: number; lastMessageAt: Date; waitingSince: Date }> }> {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    // Find conversations in this school
    const allConversations = await prisma.conversation.findMany({
      where: { schoolId },
      include: {
        teacher: { select: participantSelect },
        parent: { select: participantSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Get recent messages to check who sent last
          select: { id: true, senderUserId: true, isRead: true, createdAt: true },
        },
      },
    });

    // Filter: only conversations where the last message is from the parent,
    // sent more than 3 hours ago, and the teacher hasn't replied since
    const pendingConversations = allConversations.filter((conv) => {
      if (conv.messages.length === 0) return false;

      // Find the last message from the parent
      const lastParentMsg = conv.messages.find((m) => m.senderUserId === conv.parentUserId);
      if (!lastParentMsg) return false;

      // Check if the teacher has replied after the parent's last message
      const lastTeacherMsg = conv.messages.find((m) => m.senderUserId === conv.teacherUserId);
      if (lastTeacherMsg && lastTeacherMsg.createdAt > lastParentMsg.createdAt) {
        return false; // Teacher already replied
      }

      // Check if the parent's message is older than 3 hours
      return lastParentMsg.createdAt <= threeHoursAgo;
    });

    // Fetch child info
    const childIds = pendingConversations.map((c) => c.childId);
    const children = childIds.length > 0
      ? await prisma.child.findMany({
          where: { id: { in: childIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const childMap = new Map(children.map((c) => [c.id, c]));

    const conversations = pendingConversations.map((conv) => {
      const lastParentMsg = conv.messages.find((m) => m.senderUserId === conv.parentUserId)!;
      const unreadCount = conv.messages.filter((m) => !m.isRead && m.senderUserId === conv.parentUserId).length;

      return {
        ...conv,
        messages: undefined as never,
        child: childMap.get(conv.childId) || { id: conv.childId, firstName: '', lastName: '' },
        unreadCount,
        waitingSince: lastParentMsg.createdAt,
      };
    });

    return { conversations };
  }

  /**
   * Get messages in a conversation with pagination.
   * Only participants (teacher or parent in the conversation) can access messages.
   * Admins can also access messages.
   */
  async getMessages(
    conversationId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    page: number,
    pageSize: number,
  ): Promise<{ messages: MessageResponse[]; total: number }> {
    // Verify conversation exists and user has access
    const conversation = await this.verifyConversationAccess(conversationId, schoolId, userId, userRole);

    const where = { conversationId: conversation.id };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: participantSelect },
        },
      }),
      prisma.message.count({ where }),
    ]);

    // Generate signed URLs for photo/document messages
    const messagesWithUrls: MessageResponse[] = messages.map((msg) => {
      const response: MessageResponse = {
        ...msg,
        sender: msg.sender,
      };

      if (msg.cloudinaryPublicId && (msg.messageType === 'photo' || msg.messageType === 'document')) {
        response.mediaUrl = cloudinaryService.generateSignedUrl(
          msg.cloudinaryPublicId,
          msg.messageType === 'photo' ? 'photo' : 'document',
        );
      }

      return response;
    });

    return { messages: messagesWithUrls, total };
  }

  /**
   * Send a message in a conversation.
   * Only participants (teacher or parent) can send messages.
   * Emits "message:new" event to the conversation room via Socket.io.
   * Updates lastMessageAt on the conversation.
   */
  async sendMessage(
    conversationId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    input: SendMessageInput,
  ): Promise<MessageResponse> {
    // Verify conversation exists and user has access
    const conversation = await this.verifyConversationAccess(conversationId, schoolId, userId, userRole);

    // Only teacher and parent participants can send messages (not admins viewing)
    if (userId !== conversation.teacherUserId && userId !== conversation.parentUserId) {
      throw new CommunicationServiceError(
        'Only conversation participants can send messages',
        403,
      );
    }

    // Create the message and update lastMessageAt in a transaction
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderUserId: userId,
          content: input.content || null,
          messageType: input.messageType,
          cloudinaryPublicId: input.cloudinaryPublicId || null,
        },
        include: {
          sender: { select: participantSelect },
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Build response with signed URL if applicable
    const response: MessageResponse = {
      ...message,
      sender: message.sender,
    };

    if (message.cloudinaryPublicId && (message.messageType === 'photo' || message.messageType === 'document')) {
      response.mediaUrl = cloudinaryService.generateSignedUrl(
        message.cloudinaryPublicId,
        message.messageType === 'photo' ? 'photo' : 'document',
      );
    }

    // Emit "message:new" event to the conversation room
    const room = `conversation:${conversation.id}`;
    socketService.emitToRoom(room, 'message:new', response);

    return response;
  }

  /**
   * Mark a message as read.
   * Only the recipient (not the sender) can mark a message as read.
   * Emits "message:read" event to the conversation room.
   */
  async markMessageAsRead(
    messageId: string,
    schoolId: string,
    userId: string,
    userRole: string,
  ): Promise<MessageResponse> {
    // Find the message
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: {
        conversation: true,
        sender: { select: participantSelect },
      },
    });

    if (!message) {
      throw new CommunicationServiceError('Message not found', 404);
    }

    // Verify the conversation belongs to this school
    if (message.conversation.schoolId !== schoolId) {
      throw new CommunicationServiceError('Message not found', 404);
    }

    // Verify user is a participant in the conversation
    const conversation = message.conversation;
    if (
      userRole !== 'admin' &&
      userRole !== 'super_admin' &&
      userId !== conversation.teacherUserId &&
      userId !== conversation.parentUserId
    ) {
      throw new CommunicationServiceError('You do not have access to this message', 403);
    }

    // Only the recipient (not the sender) can mark as read
    if (message.senderUserId === userId) {
      throw new CommunicationServiceError('You cannot mark your own message as read', 400);
    }

    // Already read — return as-is
    if (message.isRead) {
      const response: MessageResponse = {
        id: message.id,
        conversationId: message.conversationId,
        senderUserId: message.senderUserId,
        content: message.content,
        messageType: message.messageType,
        cloudinaryPublicId: message.cloudinaryPublicId,
        isRead: message.isRead,
        createdAt: message.createdAt,
        sender: message.sender,
      };
      return response;
    }

    // Update the message
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
      include: {
        sender: { select: participantSelect },
      },
    });

    const response: MessageResponse = {
      ...updated,
      sender: updated.sender,
    };

    // Emit "message:read" event to the conversation room
    const room = `conversation:${conversation.id}`;
    socketService.emitToRoom(room, 'message:read', { messageId, readBy: userId });

    return response;
  }

  /**
   * Create a daily report for a child.
   * Teachers can only create reports for children in their classroom.
   * Enforces one report per child per day (unique constraint).
   * Emits "report:new" to all linked parents' user rooms.
   */
  async createDailyReport(
    schoolId: string,
    userId: string,
    userRole: string,
    input: CreateDailyReportInput,
  ): Promise<DailyReportResponse> {
    const { childId, date, mood, mealsEaten, napDurationMinutes, activities, generalNote } = input;

    // Verify the child belongs to this school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!child) {
      throw new CommunicationServiceError('Child not found or does not belong to this school', 404);
    }

    // If teacher, verify they are assigned to a classroom where this child is enrolled
    if (userRole === 'teacher') {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });

      if (!enrollment) {
        throw new CommunicationServiceError(
          'You can only create reports for children in your classroom',
          403,
        );
      }
    }

    // Parse the date string to a Date object (date-only)
    const reportDate = new Date(date + 'T00:00:00.000Z');

    // Check if a report already exists for this child on this date
    const existingReport = await prisma.dailyReport.findUnique({
      where: { childId_date: { childId, date: reportDate } },
    });

    if (existingReport) {
      throw new CommunicationServiceError(
        'A daily report already exists for this child on this date',
        409,
      );
    }

    // Create the daily report
    const report = await prisma.dailyReport.create({
      data: {
        schoolId,
        childId,
        date: reportDate,
        mood,
        mealsEaten,
        napDurationMinutes: napDurationMinutes ?? null,
        activities: activities ?? null,
        generalNote: generalNote ?? null,
        createdByUserId: userId,
      },
      include: {
        photos: true,
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Get the creator info
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    // Build response
    const response: DailyReportResponse = {
      id: report.id,
      schoolId: report.schoolId,
      childId: report.childId,
      date: report.date,
      mood: report.mood,
      mealsEaten: report.mealsEaten,
      napDurationMinutes: report.napDurationMinutes,
      activities: report.activities,
      generalNote: report.generalNote,
      createdByUserId: report.createdByUserId,
      createdAt: report.createdAt,
      photos: [],
      child: report.child,
      createdBy: creator || undefined,
    };

    // Emit "report:new" to all linked parents' user rooms
    const parentLinks = await prisma.parentChildLink.findMany({
      where: { childId },
      select: { parentUserId: true },
    });

    for (const link of parentLinks) {
      socketService.emitToUser(link.parentUserId, 'report:new', response);
    }

    return response;
  }

  /**
   * Get daily reports for a child with pagination and optional date filter.
   * Teachers can only view reports for children in their classroom.
   * Parents can only view reports for their linked children.
   */
  async getDailyReportsForChild(
    childId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    page: number,
    pageSize: number,
    dateFilter?: string,
  ): Promise<{ reports: DailyReportResponse[]; total: number }> {
    // Verify the child belongs to this school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!child) {
      throw new CommunicationServiceError('Child not found or does not belong to this school', 404);
    }

    // Access control
    if (userRole === 'teacher') {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });

      if (!enrollment) {
        throw new CommunicationServiceError(
          'You can only view reports for children in your classroom',
          403,
        );
      }
    } else if (userRole === 'parent') {
      const parentLink = await prisma.parentChildLink.findFirst({
        where: { childId, parentUserId: userId },
      });

      if (!parentLink) {
        throw new CommunicationServiceError(
          'You can only view reports for your linked children',
          403,
        );
      }
    }

    // Build where clause
    const where: Record<string, unknown> = { childId, schoolId };
    if (dateFilter) {
      where.date = new Date(dateFilter + 'T00:00:00.000Z');
    }

    const [reports, total] = await Promise.all([
      prisma.dailyReport.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
        include: {
          photos: true,
          child: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.dailyReport.count({ where }),
    ]);

    // Get creator info for all reports
    const creatorIds = [...new Set(reports.map((r) => r.createdByUserId))];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Build responses with signed URLs for photos
    const reportResponses: DailyReportResponse[] = reports.map((report) => ({
      id: report.id,
      schoolId: report.schoolId,
      childId: report.childId,
      date: report.date,
      mood: report.mood,
      mealsEaten: report.mealsEaten,
      napDurationMinutes: report.napDurationMinutes,
      activities: report.activities,
      generalNote: report.generalNote,
      createdByUserId: report.createdByUserId,
      createdAt: report.createdAt,
      photos: report.photos.map((photo) => ({
        id: photo.id,
        dailyReportId: photo.dailyReportId,
        cloudinaryPublicId: photo.cloudinaryPublicId,
        photoUrl: cloudinaryService.generateSignedUrl(photo.cloudinaryPublicId, 'photo'),
        createdAt: photo.createdAt,
      })),
      child: report.child,
      createdBy: creatorMap.get(report.createdByUserId),
    }));

    return { reports: reportResponses, total };
  }

  /**
   * Get a single daily report by ID.
   * Access control: teachers (classroom), parents (linked), admins (school).
   */
  async getDailyReportById(
    reportId: string,
    schoolId: string,
    userId: string,
    userRole: string,
  ): Promise<DailyReportResponse> {
    const report = await prisma.dailyReport.findFirst({
      where: { id: reportId, schoolId },
      include: {
        photos: true,
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!report) {
      throw new CommunicationServiceError('Daily report not found', 404);
    }

    // Access control
    if (userRole === 'teacher') {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId: report.childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });

      if (!enrollment) {
        throw new CommunicationServiceError(
          'You can only view reports for children in your classroom',
          403,
        );
      }
    } else if (userRole === 'parent') {
      const parentLink = await prisma.parentChildLink.findFirst({
        where: { childId: report.childId, parentUserId: userId },
      });

      if (!parentLink) {
        throw new CommunicationServiceError(
          'You can only view reports for your linked children',
          403,
        );
      }
    }

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: report.createdByUserId },
      select: { id: true, firstName: true, lastName: true },
    });

    return {
      id: report.id,
      schoolId: report.schoolId,
      childId: report.childId,
      date: report.date,
      mood: report.mood,
      mealsEaten: report.mealsEaten,
      napDurationMinutes: report.napDurationMinutes,
      activities: report.activities,
      generalNote: report.generalNote,
      createdByUserId: report.createdByUserId,
      createdAt: report.createdAt,
      photos: report.photos.map((photo) => ({
        id: photo.id,
        dailyReportId: photo.dailyReportId,
        cloudinaryPublicId: photo.cloudinaryPublicId,
        photoUrl: cloudinaryService.generateSignedUrl(photo.cloudinaryPublicId, 'photo'),
        createdAt: photo.createdAt,
      })),
      child: report.child,
      createdBy: creator || undefined,
    };
  }

  /**
   * Upload a photo to an existing daily report.
   * Only teachers/admins who created the report (or admins in the school) can upload.
   */
  async uploadDailyReportPhoto(
    reportId: string,
    schoolId: string,
    userId: string,
    userRole: string,
    input: UploadDailyReportPhotoInput,
  ): Promise<DailyReportPhotoResponse> {
    // Verify the report exists and belongs to this school
    const report = await prisma.dailyReport.findFirst({
      where: { id: reportId, schoolId },
    });

    if (!report) {
      throw new CommunicationServiceError('Daily report not found', 404);
    }

    // Teachers can only upload photos to reports for children in their classroom
    if (userRole === 'teacher') {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: {
          childId: report.childId,
          classroom: { teacherUserId: userId, schoolId },
        },
      });

      if (!enrollment) {
        throw new CommunicationServiceError(
          'You can only upload photos to reports for children in your classroom',
          403,
        );
      }
    }

    // Create the photo record
    const photo = await prisma.dailyReportPhoto.create({
      data: {
        dailyReportId: reportId,
        cloudinaryPublicId: input.cloudinaryPublicId,
      },
    });

    return {
      id: photo.id,
      dailyReportId: photo.dailyReportId,
      cloudinaryPublicId: photo.cloudinaryPublicId,
      photoUrl: cloudinaryService.generateSignedUrl(photo.cloudinaryPublicId, 'photo'),
      createdAt: photo.createdAt,
    };
  }

  /**
   * Create and publish an announcement.
   * Only admins can create announcements.
   * If classroomId is provided, targets that classroom; otherwise targets the entire school.
   * Emits "announcement:new" to the appropriate room and sends push notifications.
   */
  async createAnnouncement(
    schoolId: string,
    userId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementResponse> {
    const { title, content, classroomId } = input;

    // If classroomId is provided, verify it belongs to this school
    if (classroomId) {
      const classroom = await prisma.classroom.findFirst({
        where: { id: classroomId, schoolId },
      });

      if (!classroom) {
        throw new CommunicationServiceError('Classroom not found or does not belong to this school', 404);
      }
    }

    const publishedAt = new Date();

    // Create the announcement
    const announcement = await prisma.announcement.create({
      data: {
        schoolId,
        classroomId: classroomId || null,
        title,
        content,
        createdByUserId: userId,
        publishedAt,
      },
    });

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    const response: AnnouncementResponse = {
      id: announcement.id,
      schoolId: announcement.schoolId,
      classroomId: announcement.classroomId,
      title: announcement.title,
      content: announcement.content,
      createdByUserId: announcement.createdByUserId,
      publishedAt: announcement.publishedAt,
      createdAt: announcement.createdAt,
      createdBy: creator || undefined,
    };

    // Emit "announcement:new" to the appropriate room
    if (classroomId) {
      // Classroom-specific announcement
      const room = `classroom:${classroomId}`;
      socketService.emitToRoom(room, 'announcement:new', response);
    } else {
      // School-wide announcement
      const room = `school:${schoolId}`;
      socketService.emitToRoom(room, 'announcement:new', response);
    }

    // Send push notifications to all targeted users
    let targetUserIds: string[] = [];

    if (classroomId) {
      // Get all users related to this classroom:
      // - The teacher assigned to the classroom
      // - Parents of children enrolled in the classroom
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { teacherUserId: true },
      });

      const enrolledChildren = await prisma.classroomEnrollment.findMany({
        where: { classroomId },
        select: { childId: true },
      });

      const childIds = enrolledChildren.map((e) => e.childId);

      const parentLinks = await prisma.parentChildLink.findMany({
        where: { childId: { in: childIds } },
        select: { parentUserId: true },
      });

      const parentIds = [...new Set(parentLinks.map((l) => l.parentUserId))];
      targetUserIds = [...parentIds];

      if (classroom?.teacherUserId) {
        targetUserIds.push(classroom.teacherUserId);
      }
    } else {
      // School-wide: notify all active users in the school (except the creator)
      const users = await prisma.user.findMany({
        where: { schoolId, isActive: true, id: { not: userId } },
        select: { id: true },
      });

      targetUserIds = users.map((u) => u.id);
    }

    // Send push notifications via NotificationService
    if (targetUserIds.length > 0) {
      notificationService.notifyMany(targetUserIds, {
        title,
        body: content.length > 200 ? content.substring(0, 200) + '...' : content,
        type: 'announcement',
        referenceId: announcement.id,
        referenceType: 'announcement',
        channels: ['push', 'email'],
      }).catch((err) => {
        console.error('[CommunicationService] Failed to send announcement notifications:', err);
      });
    }

    return response;
  }

  /**
   * List announcements for the current user's school.
   * Supports optional classroomId filter.
   * All active users in the school can view announcements.
   */
  async listAnnouncements(
    schoolId: string,
    page: number,
    pageSize: number,
    classroomId?: string,
  ): Promise<{ announcements: AnnouncementResponse[]; total: number }> {
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where: classroomId
          ? { schoolId, publishedAt: { not: null }, OR: [{ classroomId }, { classroomId: null }] }
          : { schoolId, publishedAt: { not: null } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.announcement.count({
        where: classroomId
          ? { schoolId, publishedAt: { not: null }, OR: [{ classroomId }, { classroomId: null }] }
          : { schoolId, publishedAt: { not: null } },
      }),
    ]);

    // Get creator info for all announcements
    const creatorIds = [...new Set(announcements.map((a) => a.createdByUserId))];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    const announcementResponses: AnnouncementResponse[] = announcements.map((a) => ({
      id: a.id,
      schoolId: a.schoolId,
      classroomId: a.classroomId,
      title: a.title,
      content: a.content,
      createdByUserId: a.createdByUserId,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      createdBy: creatorMap.get(a.createdByUserId),
    }));

    return { announcements: announcementResponses, total };
  }

  /**
   * Get a single announcement by ID.
   * All active users in the school can view announcements.
   */
  async getAnnouncementById(
    announcementId: string,
    schoolId: string,
  ): Promise<AnnouncementResponse> {
    const announcement = await prisma.announcement.findFirst({
      where: { id: announcementId, schoolId },
    });

    if (!announcement) {
      throw new CommunicationServiceError('Announcement not found', 404);
    }

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: announcement.createdByUserId },
      select: { id: true, firstName: true, lastName: true },
    });

    return {
      id: announcement.id,
      schoolId: announcement.schoolId,
      classroomId: announcement.classroomId,
      title: announcement.title,
      content: announcement.content,
      createdByUserId: announcement.createdByUserId,
      publishedAt: announcement.publishedAt,
      createdAt: announcement.createdAt,
      createdBy: creator || undefined,
    };
  }

  async deleteAnnouncement(announcementId: string, schoolId: string): Promise<void> {
    const announcement = await prisma.announcement.findFirst({ where: { id: announcementId, schoolId } });
    if (!announcement) throw new CommunicationServiceError('Announcement not found', 404);
    await prisma.announcement.delete({ where: { id: announcementId } });
  }

  async deleteEvent(eventId: string, schoolId: string): Promise<void> {
    const event = await prisma.event.findFirst({ where: { id: eventId, schoolId } });
    if (!event) throw new CommunicationServiceError('Event not found', 404);
    await prisma.$transaction([
      prisma.consentForm.deleteMany({ where: { eventId } }),
      prisma.event.delete({ where: { id: eventId } }),
    ]);
  }

  /**
   * Verify that a user has access to a conversation.
   * Returns the conversation if access is granted.
   */
  private async verifyConversationAccess(
    conversationId: string,
    schoolId: string,
    userId: string,
    userRole: string,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, schoolId },
    });

    if (!conversation) {
      throw new CommunicationServiceError('Conversation not found', 404);
    }

    // Admins can access any conversation in their school
    if (userRole === 'admin' || userRole === 'super_admin') {
      return conversation;
    }

    // Teachers and parents can only access their own conversations
    if (userId !== conversation.teacherUserId && userId !== conversation.parentUserId) {
      throw new CommunicationServiceError('You do not have access to this conversation', 403);
    }

    return conversation;
  }

  // ─── Events & Consent Forms ──────────────────────────────────────────────────

  /**
   * Create an event for the school, optionally scoped to a single classroom.
   * Only admins can create events.
   * When requires_consent is true, generates ConsentForm records for each active
   * child in the school — or, when classroomId is set, only for children enrolled
   * in that classroom.
   */
  async createEvent(
    schoolId: string,
    userId: string,
    input: CreateEventInput,
  ): Promise<EventResponse> {
    const { title, description, startDatetime, endDatetime, location, requiresConsent, classroomId } = input;

    // If classroomId is provided, verify it belongs to this school
    let classroom: { id: string; name: string } | null = null;
    if (classroomId) {
      classroom = await prisma.classroom.findFirst({
        where: { id: classroomId, schoolId },
        select: { id: true, name: true },
      });

      if (!classroom) {
        throw new CommunicationServiceError('Classroom not found or does not belong to this school', 404);
      }
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        schoolId,
        classroomId: classroomId || null,
        title,
        description: description || null,
        startDatetime: new Date(startDatetime),
        endDatetime: endDatetime ? new Date(endDatetime) : null,
        location: location || null,
        requiresConsent,
        createdByUserId: userId,
      },
    });

    let consentForms: ConsentFormResponse[] = [];

    // If requires_consent, generate ConsentForm records for each active child in
    // the school (or, when scoped to a classroom, just the children enrolled in it)
    if (requiresConsent) {
      const activeChildren = await prisma.child.findMany({
        where: {
          schoolId,
          isActive: true,
          ...(classroomId && { enrollments: { some: { classroomId } } }),
        },
        select: { id: true, firstName: true, lastName: true },
      });

      if (activeChildren.length > 0) {
        await prisma.consentForm.createMany({
          data: activeChildren.map((child) => ({
            eventId: event.id,
            childId: child.id,
          })),
        });

        // Fetch the created consent forms
        const createdForms = await prisma.consentForm.findMany({
          where: { eventId: event.id },
          include: {
            child: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        consentForms = createdForms.map((form) => ({
          id: form.id,
          eventId: form.eventId,
          childId: form.childId,
          status: form.status,
          respondedAt: form.respondedAt,
          createdAt: form.createdAt,
          child: form.child,
        }));
      }
    }

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    return {
      id: event.id,
      schoolId: event.schoolId,
      classroomId: event.classroomId,
      title: event.title,
      description: event.description,
      startDatetime: event.startDatetime,
      endDatetime: event.endDatetime,
      location: event.location,
      requiresConsent: event.requiresConsent,
      createdByUserId: event.createdByUserId,
      createdAt: event.createdAt,
      createdBy: creator || undefined,
      classroom,
      consentForms,
    };
  }

  /**
   * List events for the school with pagination.
   * All active users (admin, teacher, parent) can view events.
   */
  async listEvents(
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ events: EventResponse[]; total: number }> {
    const where = { schoolId };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDatetime: 'desc' },
      }),
      prisma.event.count({ where }),
    ]);

    // Get creator info for all events
    const creatorIds = [...new Set(events.map((e) => e.createdByUserId))];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Get classroom info for scoped events
    const classroomIds = [...new Set(events.map((e) => e.classroomId).filter((id): id is string => !!id))];
    const classrooms = classroomIds.length > 0
      ? await prisma.classroom.findMany({
          where: { id: { in: classroomIds } },
          select: { id: true, name: true },
        })
      : [];
    const classroomMap = new Map(classrooms.map((c) => [c.id, c]));

    // Compute consent stats in a single query for events that require consent,
    // rather than fetching full ConsentForm rows per event.
    const consentEventIds = events.filter((e) => e.requiresConsent).map((e) => e.id);
    const consentStatuses = consentEventIds.length > 0
      ? await prisma.consentForm.findMany({
          where: { eventId: { in: consentEventIds } },
          select: { eventId: true, status: true },
        })
      : [];
    const statsByEvent = new Map<string, { total: number; approved: number; declined: number; pending: number }>();
    for (const form of consentStatuses) {
      const stats = statsByEvent.get(form.eventId) ?? { total: 0, approved: 0, declined: 0, pending: 0 };
      stats.total += 1;
      stats[form.status] += 1;
      statsByEvent.set(form.eventId, stats);
    }

    const eventResponses: EventResponse[] = events.map((event) => ({
      id: event.id,
      schoolId: event.schoolId,
      classroomId: event.classroomId,
      title: event.title,
      description: event.description,
      startDatetime: event.startDatetime,
      endDatetime: event.endDatetime,
      location: event.location,
      requiresConsent: event.requiresConsent,
      createdByUserId: event.createdByUserId,
      createdAt: event.createdAt,
      createdBy: creatorMap.get(event.createdByUserId),
      classroom: event.classroomId ? classroomMap.get(event.classroomId) ?? null : null,
      consentStats: event.requiresConsent
        ? statsByEvent.get(event.id) ?? { total: 0, approved: 0, declined: 0, pending: 0 }
        : undefined,
    }));

    return { events: eventResponses, total };
  }

  /**
   * Get a single event by ID with its consent forms.
   * All active users in the school can view events.
   */
  async getEventById(
    eventId: string,
    schoolId: string,
    requestingParentUserId?: string,
  ): Promise<EventResponse> {
    const event = await prisma.event.findFirst({
      where: { id: eventId, schoolId },
      include: {
        consentForms: {
          include: {
            child: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!event) {
      throw new CommunicationServiceError('Event not found', 404);
    }

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: event.createdByUserId },
      select: { id: true, firstName: true, lastName: true },
    });

    // Get classroom info if scoped
    const classroom = event.classroomId
      ? await prisma.classroom.findUnique({
          where: { id: event.classroomId },
          select: { id: true, name: true },
        })
      : null;

    let visibleConsentForms = event.consentForms;
    if (requestingParentUserId) {
      const ownChildIds = new Set(
        (
          await prisma.parentChildLink.findMany({
            where: { parentUserId: requestingParentUserId },
            select: { childId: true },
          })
        ).map((link) => link.childId),
      );
      visibleConsentForms = event.consentForms.filter((form) => ownChildIds.has(form.childId));
    }

    const consentForms: ConsentFormResponse[] = visibleConsentForms.map((form) => ({
      id: form.id,
      eventId: form.eventId,
      childId: form.childId,
      status: form.status,
      respondedAt: form.respondedAt,
      createdAt: form.createdAt,
      child: form.child,
    }));

    return {
      id: event.id,
      schoolId: event.schoolId,
      classroomId: event.classroomId,
      title: event.title,
      description: event.description,
      startDatetime: event.startDatetime,
      endDatetime: event.endDatetime,
      location: event.location,
      requiresConsent: event.requiresConsent,
      createdByUserId: event.createdByUserId,
      createdAt: event.createdAt,
      createdBy: creator || undefined,
      classroom,
      consentForms,
    };
  }

  /**
   * Respond to a consent form for a specific child.
   * Only parents linked to the child can respond.
   * Updates the consent status and sets responded_at timestamp.
   */
  async respondToConsent(
    eventId: string,
    childId: string,
    schoolId: string,
    userId: string,
    input: RespondConsentInput,
  ): Promise<ConsentFormResponse> {
    // Verify the event exists and belongs to this school
    const event = await prisma.event.findFirst({
      where: { id: eventId, schoolId },
    });

    if (!event) {
      throw new CommunicationServiceError('Event not found', 404);
    }

    // Verify the parent is linked to this child
    const parentLink = await prisma.parentChildLink.findFirst({
      where: { childId, parentUserId: userId },
    });

    if (!parentLink) {
      throw new CommunicationServiceError(
        'You can only respond to consent forms for your linked children',
        403,
      );
    }

    // Find the consent form
    const consentForm = await prisma.consentForm.findUnique({
      where: { eventId_childId: { eventId, childId } },
    });

    if (!consentForm) {
      throw new CommunicationServiceError('Consent form not found for this child and event', 404);
    }

    // Update the consent form
    const updated = await prisma.consentForm.update({
      where: { id: consentForm.id },
      data: {
        status: input.status,
        respondedAt: new Date(),
      },
      include: {
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      id: updated.id,
      eventId: updated.eventId,
      childId: updated.childId,
      status: updated.status,
      respondedAt: updated.respondedAt,
      createdAt: updated.createdAt,
      child: updated.child,
    };
  }

  /**
   * Get daily reports for all children linked to a parent.
   */
  async getReportsForParent(schoolId: string, parentUserId: string) {
    // Find all children linked to this parent
    const links = await prisma.parentChildLink.findMany({
      where: { parentUserId },
      select: { childId: true },
    });

    if (links.length === 0) return [];

    const childIds = links.map((l) => l.childId);

    // Get recent reports for these children (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const reports = await prisma.dailyReport.findMany({
      where: {
        childId: { in: childIds },
        schoolId,
        date: { gte: thirtyDaysAgo },
      },
      include: {
        photos: true,
        child: { select: { id: true, firstName: true, lastName: true, photoPublicId: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    return reports.map((r) => ({
      id: r.id,
      child_id: r.childId,
      child_name: `${r.child.firstName} ${r.child.lastName}`,
      child_photo_url: r.child.photoPublicId || null,
      date: r.date.toISOString().split('T')[0],
      mood: r.mood,
      meals_eaten: r.mealsEaten,
      nap_duration_minutes: r.napDurationMinutes ?? 0,
      activities: r.activities ?? '',
      general_note: r.generalNote ?? '',
      photos: r.photos.map((p) => ({ url: p.cloudinaryPublicId })),
    }));
  }
}

export const communicationService = new CommunicationService();
