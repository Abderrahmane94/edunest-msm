import prisma from '../../lib/prisma';

type MessageKind = 'text' | 'photo' | 'document';

const LABELS = {
  fr: { newMessage: 'Nouveau message', photo: '📷 Photo', document: '📎 Document' },
  ar: { newMessage: 'رسالة جديدة', photo: '📷 صورة', document: '📎 مستند' },
};

/**
 * Title and text of a "new message" notification, in the recipient's
 * language: the sender's name, and the message (or "Photo" / "Document").
 */
export async function newMessageNotificationText(
  recipientUserId: string,
  senderName: string,
  messageType: MessageKind,
  content: string | null | undefined,
): Promise<{ title: string; body: string }> {
  const recipient = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: { preferredLanguage: true },
  });
  const labels = LABELS[recipient?.preferredLanguage === 'ar' ? 'ar' : 'fr'];
  const body =
    messageType === 'text' ? (content || '').slice(0, 200) : messageType === 'photo' ? labels.photo : labels.document;
  return { title: senderName || labels.newMessage, body };
}
