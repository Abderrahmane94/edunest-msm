import type { ElementType } from 'react';
import {
  Bell,
  UserX,
  CreditCard,
  FileText,
  MessageCircle,
  Megaphone,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { NotificationType } from '@/hooks/useNotificationCenter';

const ICONS: Record<NotificationType, ElementType> = {
  absence_alert: UserX,
  payment_received: CreditCard,
  payment_overdue: AlertCircle,
  invoice_sent: FileText,
  daily_report: FileText,
  message_new: MessageCircle,
  announcement: Megaphone,
  event_consent: Calendar,
};

const ICON_COLORS: Record<NotificationType, string> = {
  absence_alert: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
  payment_received: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  payment_overdue: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
  invoice_sent: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  daily_report: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  message_new: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  announcement: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  event_consent: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
};

export function notificationIcon(type: NotificationType): ElementType {
  return ICONS[type] ?? Bell;
}

export function notificationIconColor(type: NotificationType): string {
  return ICON_COLORS[type] ?? 'bg-subtle text-text-secondary';
}

/** Compact relative time (e.g. "2h", "3d") localized for fr/ar. */
export function formatRelativeTime(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'fr', { numeric: 'auto' });

    if (diffMinutes < 1) return rtf.format(0, 'minute');
    if (diffMinutes < 60) return rtf.format(-diffMinutes, 'minute');
    if (diffHours < 24) return rtf.format(-diffHours, 'hour');
    if (diffDays < 7) return rtf.format(-diffDays, 'day');

    return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Maps a notification's reference to an in-app route so clicking navigates to
 * the relevant screen, per the user's portal (admin/teacher/parent).
 */
export function notificationLink(
  n: { type: NotificationType; reference_type?: string; reference_id?: string },
  role: 'super_admin' | 'admin' | 'teacher' | 'parent',
): string | null {
  const base = role === 'parent' ? '/parent' : role === 'teacher' ? '/teacher' : '/admin';

  switch (n.type) {
    case 'message_new':
      return role === 'parent' ? `${base}/messages` : `${base}/messages`;
    case 'absence_alert':
      return role === 'parent' ? `${base}/attendance` : `${base}/attendance`;
    case 'invoice_sent':
    case 'payment_received':
    case 'payment_overdue':
      return role === 'parent' ? `${base}/invoices` : `${base}/payments`;
    case 'announcement':
      return `${base}/announcements`;
    case 'daily_report':
      return role === 'parent' ? `${base}` : `${base}/daily-reports`;
    case 'event_consent':
      return role === 'parent' ? `${base}/announcements` : `${base}/events`;
    default:
      return null;
  }
}
