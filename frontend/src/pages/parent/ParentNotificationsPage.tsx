import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  CheckCheck,
  UserX,
  CreditCard,
  FileText,
  MessageCircle,
  Megaphone,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

type NotificationType =
  | 'absence_alert'
  | 'payment_received'
  | 'payment_overdue'
  | 'invoice_sent'
  | 'daily_report'
  | 'message_new'
  | 'announcement'
  | 'event_consent';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}

function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<{ notifications: Notification[] }>('/notifications');
      return res.data?.notifications ?? [];
    },
  });
}

function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiClient.put(`/notifications/${notificationId}/read`);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to mark notification as read');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.put('/notifications/read-all');
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to mark all notifications as read');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  absence_alert: UserX,
  payment_received: CreditCard,
  payment_overdue: AlertCircle,
  invoice_sent: FileText,
  daily_report: FileText,
  message_new: MessageCircle,
  announcement: Megaphone,
  event_consent: Calendar,
};

const NOTIFICATION_ICON_COLORS: Record<NotificationType, string> = {
  absence_alert: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]',
  payment_received: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  payment_overdue: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
  invoice_sent: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  daily_report: 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
  message_new: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  announcement: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]',
  event_consent: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]',
};

function formatRelativeTime(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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

export function ParentNotificationsPage() {
  const { t, i18n } = useTranslation();
  const { data: notifications, isLoading, isError } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = React.useMemo(
    () => notifications?.filter((n) => !n.is_read).length ?? 0,
    [notifications]
  );

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-page-title font-semibold text-text-heading">
                {t('parentNotifications.title', 'Notifications')}
              </h1>
              <p className="text-caption text-text-secondary">
                {unreadCount > 0
                  ? t('parentNotifications.unreadCount', { count: unreadCount, defaultValue: '{{count}} unread' })
                  : t('parentNotifications.allRead', 'All caught up!')}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors duration-150"
                aria-label={t('parentNotifications.markAllRead', 'Mark all as read')}
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {t('parentNotifications.markAllRead', 'Mark all as read')}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 p-4 bg-card border border-border rounded-xl">
                <div className="w-10 h-10 rounded-full bg-subtle shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-subtle rounded w-3/4" />
                  <div className="h-3 bg-subtle rounded w-full" />
                  <div className="h-3 bg-subtle rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-body text-text-secondary">
              {t('parentNotifications.error', 'Unable to load notifications. Please try again.')}
            </p>
          </div>
        ) : notifications && notifications.length > 0 ? (
          <ul role="list" className="space-y-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                locale={i18n.language}
              />
            ))}
          </ul>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
              <BellOff className="w-8 h-8 text-text-secondary" />
            </div>
            <p className="text-body text-text-secondary">
              {t('parentNotifications.empty', 'No notifications yet.')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function NotificationItem({
  notification,
  locale,
}: {
  notification: Notification;
  locale: string;
}) {
  const markRead = useMarkNotificationRead();

  const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;
  const iconColorClass = NOTIFICATION_ICON_COLORS[notification.type] ?? 'bg-subtle text-text-secondary';

  const handleClick = React.useCallback(() => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
  }, [notification.id, notification.is_read, markRead]);

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full flex items-start gap-3 p-4 rounded-xl border text-start transition-colors duration-150',
          notification.is_read
            ? 'bg-card border-border hover:bg-hover'
            : 'bg-card border-[var(--color-accent-muted)] hover:bg-[var(--color-accent-muted)]/30'
        )}
        aria-label={notification.title}
      >
        {/* Icon */}
        <div
          className={cn(
            'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            iconColorClass
          )}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                'text-body truncate',
                notification.is_read ? 'font-normal text-text-primary' : 'font-medium text-text-heading'
              )}
            >
              {notification.title}
            </h3>
            {!notification.is_read && (
              <span
                className="shrink-0 w-2 h-2 mt-2 rounded-full bg-[var(--color-accent)]"
                aria-label="Unread"
              />
            )}
          </div>
          <p className="text-caption text-text-secondary mt-0.5 line-clamp-2">
            {notification.body}
          </p>
          <p className="text-micro text-text-disabled mt-1">
            {formatRelativeTime(notification.created_at, locale)}
          </p>
        </div>
      </button>
    </li>
  );
}
