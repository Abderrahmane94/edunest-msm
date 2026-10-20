import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';

type MessageKind = 'text' | 'photo' | 'document';

const LABELS = {
  fr: { newMessage: 'Nouveau message', photo: '📷 Photo', document: '📎 Document' },
  ar: { newMessage: 'رسالة جديدة', photo: '📷 صورة', document: '📎 مستند' },
};

/**
 * Title and text of a "new message" notification, in the recipient's
 * language: the sender's name, and the message (or "Photo" / "Document");
 * with the sender's photo when they have one, as on a phone's messages.
 */
export async function newMessageNotificationText(
  recipientUserId: string,
  senderName: string,
  messageType: MessageKind,
  content: string | null | undefined,
  senderUserId?: string,
): Promise<{ title: string; body: string; icon?: string }> {
  const [recipient, sender] = await Promise.all([
    prisma.user.findUnique({ where: { id: recipientUserId }, select: { preferredLanguage: true } }),
    senderUserId ? prisma.user.findUnique({ where: { id: senderUserId }, select: { avatarPublicId: true } }) : null,
  ]);
  const icon = sender?.avatarPublicId ? (cloudinaryService.notificationIconUrl(sender.avatarPublicId, 'fill') ?? undefined) : undefined;
  const labels = LABELS[recipient?.preferredLanguage === 'ar' ? 'ar' : 'fr'];
  const body =
    messageType === 'text' ? (content || '').slice(0, 200) : messageType === 'photo' ? labels.photo : labels.document;
  return { title: senderName || labels.newMessage, body, ...(icon && { icon }) };
}
