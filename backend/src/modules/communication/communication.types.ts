import { MessageType, Mood, ConsentStatus } from '@prisma/client';

// ─── Announcement Types ──────────────────────────────────────────────────────

export interface AnnouncementResponse {
  id: string;
  schoolId: string;
  classroomId: string | null;
  title: string;
  content: string;
  createdByUserId: string;
  publishedAt: Date | null;
  createdAt: Date;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ConversationResponse {
  id: string;
  schoolId: string;
  childId: string;
  teacherUserId: string;
  parentUserId: string;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface ConversationWithParticipants extends ConversationResponse {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
  parent: {
    id: string;
    firstName: string;
    lastName: string;
  };
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string | null;
  messageType: MessageType;
  cloudinaryPublicId: string | null;
  mediaUrl?: string;
  isRead: boolean;
  createdAt: Date;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateConversationInput {
  childId: string;
  parentUserId: string;
}

export interface SendMessageInput {
  content?: string;
  messageType: MessageType;
  cloudinaryPublicId?: string;
}


// ─── Daily Report Types ──────────────────────────────────────────────────────

export interface DailyReportPhotoResponse {
  id: string;
  dailyReportId: string;
  cloudinaryPublicId: string;
  photoUrl: string;
  createdAt: Date;
}

export interface DailyReportResponse {
  id: string;
  schoolId: string;
  childId: string;
  date: Date;
  mood: Mood;
  mealsEaten: number;
  napDurationMinutes: number | null;
  activities: string | null;
  generalNote: string | null;
  createdByUserId: string;
  createdAt: Date;
  photos: DailyReportPhotoResponse[];
  child?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}


// ─── Event & Consent Form Types ──────────────────────────────────────────────

export interface ConsentFormResponse {
  id: string;
  eventId: string;
  childId: string;
  status: ConsentStatus;
  respondedAt: Date | null;
  createdAt: Date;
  child?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface EventResponse {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  startDatetime: Date;
  endDatetime: Date | null;
  location: string | null;
  requiresConsent: boolean;
  createdByUserId: string;
  createdAt: Date;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  consentForms?: ConsentFormResponse[];
}
