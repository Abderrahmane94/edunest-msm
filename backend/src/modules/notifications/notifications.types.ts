import { NotificationType } from '@prisma/client';

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId: string | null;
  referenceType: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface UnreadCountResponse {
  count: number;
}
