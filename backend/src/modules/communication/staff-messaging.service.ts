import prisma from '../../lib/prisma';
import { socketService } from '../../services/socket.service';
import { cloudinaryService } from '../../services/cloudinary.service';
import { CommunicationServiceError } from './communication.service';

const participantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
};

export interface StaffConversationResponse {
  id: string;
  schoolId: string;
  initiatorId: string;
  recipientId: string;
  createdAt: Date;
  lastMessageAt: Date;
  initiator: { id: string; firstName: string; lastName: string; role: string };
  recipient: { id: string; firstName: string; lastName: string; role: string };
  unreadCount?: number;
  lastMessage?: string | null;
}

export interface StaffMessageResponse {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string | null;
  messageType: 'text' | 'photo' | 'document';
  cloudinaryPublicId: string | null;
  mediaUrl?: string;
  isRead: boolean;
  createdAt: Date;
  sender: { id: string; firstName: string; lastName: string; role: string };
}

class StaffMessagingService {
  /**
   * List all staff members (teachers + admins) in the same school,
   * excluding the requester themselves.
   */
  async listStaffColleagues(
    schoolId: string,
    userId: string,
  ): Promise<{ id: string; firstName: string; lastName: string; role: string }[]> {
    const staff = await prisma.user.findMany({
      where: {
        schoolId,
        isActive: true,
        deletedAt: null,
        id: { not: userId },
        role: { in: ['teacher', 'admin'] },
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
    return staff;
  }

  /**
   * Get or create a conversation between two staff members.
   * Teachers can only talk to other staff in the same school.
   * Admins can talk to teachers in their school.
   * Uses canonical ordering (lower UUID first) to avoid duplicates.
   */
  async getOrCreateConversation(
    schoolId: string,
    userId: string,
    userRole: string,
    targetUserId: string,
  ): Promise<StaffConversationResponse> {
    // Verify target user is staff in the same school
    const target = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        schoolId,
        isActive: true,
        deletedAt: null,
        role: { in: ['teacher', 'admin'] },
      },
      select: participantSelect,
    });

    if (!target) {
      throw new CommunicationServiceError(
        'Target user not found or is not a staff member in this school',
        404,
      );
    }

    // Prevent messaging yourself
    if (targetUserId === userId) {
      throw new CommunicationServiceError('You cannot start a conversation with yourself', 400);
    }

    // Only teachers and admins can use staff messaging
    if (!['teacher', 'admin'].includes(userRole)) {
      throw new CommunicationServiceError('Only staff members can use staff messaging', 403);
    }

    // Canonical ordering: lower UUID = initiator to prevent (A,B) and (B,A) duplicates
    const [initiatorId, recipientId] =
      userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];

    // Try to find existing conversation
    let conversation = await prisma.staffConversation.findUnique({
      where: { schoolId_initiatorId_recipientId: { schoolId, initiatorId, recipientId } },
      include: {
        initiator: { select: participantSelect },
        recipient: { select: participantSelect },
      },
    });

    if (!conversation) {
      conversation = await prisma.staffConversation.create({
        data: { schoolId, initiatorId, recipientId, lastMessageAt: new Date() },
        include: {
          initiator: { select: participantSelect },
          recipient: { select: participantSelect },
        },
      });
    }

    return this._toConversationResponse(conversation, userId);
  }

  /**
   * List all staff conversations for the requesting user.
   */
  async listConversations(
    schoolId: string,
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ conversations: StaffConversationResponse[]; total: number }> {
    const where = {
      schoolId,
      OR: [{ initiatorId: userId }, { recipientId: userId }],
    };

    const [conversations, total] = await Promise.all([
      prisma.staffConversation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          initiator: { select: participantSelect },
          recipient: { select: participantSelect },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, messageType: true, createdAt: true },
          },
        },
      }),
      prisma.staffConversation.count({ where }),
    ]);

    // Count unread messages for the current user
    const convIds = conversations.map((c) => c.id);
    const unreadCounts =
      convIds.length > 0
        ? await prisma.staffMessage.groupBy({
            by: ['conversationId'],
            where: {
              conversationId: { in: convIds },
              isRead: false,
              senderUserId: { not: userId },
            },
            _count: { id: true },
          })
        : [];
    const unreadMap = new Map(unreadCounts.map((r) => [r.conversationId, r._count.id]));

    const result: StaffConversationResponse[] = conversations.map((conv) => ({
      ...this._toConversationResponse(conv, userId),
      unreadCount: unreadMap.get(conv.id) ?? 0,
      lastMessage:
        conv.messages[0]?.messageType === 'text'
          ? conv.messages[0].content
          : conv.messages[0]?.messageType
            ? `[${conv.messages[0].messageType}]`
            : null,
    }));

    return { conversations: result, total };
  }

  /**
   * Get messages in a staff conversation.
   */
  async getMessages(
    conversationId: string,
    schoolId: string,
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ messages: StaffMessageResponse[]; total: number }> {
    const conversation = await this._verifyAccess(conversationId, schoolId, userId);

    const where = { conversationId: conversation.id };
    const [messages, total] = await Promise.all([
      prisma.staffMessage.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: participantSelect } },
      }),
      prisma.staffMessage.count({ where }),
    ]);

    return {
      messages: messages.map((m) => this._toMessageResponse(m)),
      total,
    };
  }

  /**
   * Send a text message in a staff conversation.
   */
  async sendMessage(
    conversationId: string,
    schoolId: string,
    userId: string,
    content: string,
    messageType: 'text' | 'photo' | 'document',
    cloudinaryPublicId?: string,
  ): Promise<StaffMessageResponse> {
    const conversation = await this._verifyAccess(conversationId, schoolId, userId);

    const [message] = await prisma.$transaction([
      prisma.staffMessage.create({
        data: {
          conversationId: conversation.id,
          senderUserId: userId,
          content: content || null,
          messageType,
          cloudinaryPublicId: cloudinaryPublicId || null,
        },
        include: { sender: { select: participantSelect } },
      }),
      prisma.staffConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    const response = this._toMessageResponse(message);

    // Emit to conversation room
    socketService.emitToRoom(`staff_conversation:${conversation.id}`, 'staff_message:new', response);

    return response;
  }

  /**
   * Mark a staff message as read (only recipient can mark as read).
   */
  async markAsRead(
    messageId: string,
    schoolId: string,
    userId: string,
  ): Promise<StaffMessageResponse> {
    const message = await prisma.staffMessage.findFirst({
      where: { id: messageId },
      include: {
        conversation: true,
        sender: { select: participantSelect },
      },
    });

    if (!message) {
      throw new CommunicationServiceError('Message not found', 404);
    }

    if (message.conversation.schoolId !== schoolId) {
      throw new CommunicationServiceError('Message not found', 404);
    }

    // Verify user is a participant
    const conv = message.conversation;
    if (userId !== conv.initiatorId && userId !== conv.recipientId) {
      throw new CommunicationServiceError('You do not have access to this message', 403);
    }

    if (message.senderUserId === userId) {
      throw new CommunicationServiceError('You cannot mark your own message as read', 400);
    }

    if (message.isRead) {
      return this._toMessageResponse(message);
    }

    const updated = await prisma.staffMessage.update({
      where: { id: messageId },
      data: { isRead: true },
      include: { sender: { select: participantSelect } },
    });

    socketService.emitToRoom(
      `staff_conversation:${conv.id}`,
      'staff_message:read',
      { messageId, readBy: userId },
    );

    return this._toMessageResponse(updated);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async _verifyAccess(conversationId: string, schoolId: string, userId: string) {
    const conversation = await prisma.staffConversation.findFirst({
      where: { id: conversationId, schoolId },
    });

    if (!conversation) {
      throw new CommunicationServiceError('Conversation not found', 404);
    }

    if (userId !== conversation.initiatorId && userId !== conversation.recipientId) {
      throw new CommunicationServiceError('You do not have access to this conversation', 403);
    }

    return conversation;
  }

  private _toConversationResponse(
    conv: {
      id: string;
      schoolId: string;
      initiatorId: string;
      recipientId: string;
      createdAt: Date;
      lastMessageAt: Date;
      initiator: { id: string; firstName: string; lastName: string; role: string };
      recipient: { id: string; firstName: string; lastName: string; role: string };
    },
    _requestingUserId: string,
  ): StaffConversationResponse {
    return {
      id: conv.id,
      schoolId: conv.schoolId,
      initiatorId: conv.initiatorId,
      recipientId: conv.recipientId,
      createdAt: conv.createdAt,
      lastMessageAt: conv.lastMessageAt,
      initiator: conv.initiator,
      recipient: conv.recipient,
    };
  }

  private _toMessageResponse(message: {
    id: string;
    conversationId: string;
    senderUserId: string;
    content: string | null;
    messageType: string;
    cloudinaryPublicId: string | null;
    isRead: boolean;
    createdAt: Date;
    sender: { id: string; firstName: string; lastName: string; role: string };
  }): StaffMessageResponse {
    const response: StaffMessageResponse = {
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      content: message.content,
      messageType: message.messageType as 'text' | 'photo' | 'document',
      cloudinaryPublicId: message.cloudinaryPublicId,
      isRead: message.isRead,
      createdAt: message.createdAt,
      sender: message.sender,
    };

    if (
      message.cloudinaryPublicId &&
      (message.messageType === 'photo' || message.messageType === 'document')
    ) {
      response.mediaUrl = cloudinaryService.generateSignedUrl(
        message.cloudinaryPublicId,
        message.messageType === 'photo' ? 'photo' : 'document',
      );
    }

    return response;
  }
}

export const staffMessagingService = new StaffMessagingService();
