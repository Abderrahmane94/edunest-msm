import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useNotificationsInfinite,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadCount,
  type AppNotification,
} from '@/hooks/useNotificationCenter';
import {
  notificationIcon,
  notificationIconColor,
  notificationLink,
  formatRelativeTime,
} from '@/lib/notification-display';

/**
 * Full "see all" notifications screen for the parent portal. Shares the same
 * data source (useNotificationsInfinite) and display helpers as the bell
 * dropdown, so both stay consistent.
 */
export function ParentNotificationsPage() {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfinite();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="min-h-screen bg-page">
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
        ) : notifications.length > 0 ? (
          <>
            <ul role="list" className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </ul>
            {hasNextPage && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-4 py-2 rounded-lg text-caption font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors duration-150"
                >
                  {isFetchingNextPage
                    ? t('common.loading', 'Loading…')
                    : t('parentNotifications.loadMore', 'Load older')}
                </button>
              </div>
            )}
          </>
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

function NotificationItem({ notification }: { notification: AppNotification }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();

  const Icon = notificationIcon(notification.type);
  const iconColorClass = notificationIconColor(notification.type);

  const handleClick = React.useCallback(() => {
    if (!notification.is_read) markRead.mutate(notification.id);
    const to = notificationLink(notification, user?.role ?? 'parent');
    if (to) navigate(to);
  }, [notification, markRead, navigate, user?.role]);

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
        <div
          className={cn('shrink-0 w-10 h-10 rounded-full flex items-center justify-center', iconColorClass)}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </div>

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
                aria-label={t('parentNotifications.unread', 'Unread')}
              />
            )}
          </div>
          <p className="text-caption text-text-secondary mt-0.5 line-clamp-2">{notification.body}</p>
          <p className="text-micro text-text-disabled mt-1">
            {formatRelativeTime(notification.created_at, i18n.language)}
          </p>
        </div>
      </button>
    </li>
  );
}
