import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, CheckCheck, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useNotificationsInfinite,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useRemoveNotification,
  useClearReadNotifications,
  type AppNotification,
} from '@/hooks/useNotificationCenter';
import {
  notificationIcon,
  notificationIconColor,
  notificationLink,
  formatRelativeTime,
} from '@/lib/notification-display';

/**
 * Facebook/Instagram-style notification bell: an icon button with a live
 * unread badge that opens an in-place dropdown panel of recent notifications.
 * Updates in real time (the count query is refreshed on socket events), marks
 * items read on click, and navigates to the relevant screen.
 */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadCount();
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfinite();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const clearRead = useClearReadNotifications();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const notifications = data?.pages.flatMap((p) => p.items) ?? [];
  // Read ones, loaded here or not yet (older pages).
  const readCount = Math.max(0, (data?.pages[0]?.total ?? 0) - unreadCount);

  const handleClearRead = async () => {
    const ok = await confirm({
      title: t('notifications.clearRead.title', { count: readCount }),
      description: t('notifications.clearRead.description'),
      confirmLabel: t('notifications.clearRead.confirm'),
    });
    if (ok) clearRead.mutate();
  };

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // The confirmation shows over the page, outside the panel: it doesn't close it.
      if ((e.target as Element).closest?.('[role=dialog],[role=alertdialog]')) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleItemClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const to = notificationLink(n, user?.role ?? 'parent');
    setOpen(false);
    if (to) navigate(to);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition-colors duration-150"
        aria-label={t('notifications.title')}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-danger)] text-[var(--color-text-inverse)] text-[11px] font-semibold flex items-center justify-center"
            aria-label={t('notifications.unreadCount', { count: unreadCount, defaultValue: '{{count}} unread' })}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] max-sm:fixed max-sm:inset-x-4 max-sm:top-14 max-sm:w-auto max-sm:max-w-none bg-card border border-border rounded-lg shadow-[0_10px_30px_rgba(15,23,42,0.12),0_4px_8px_rgba(15,23,42,0.06)] overflow-hidden z-50"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-subsection font-semibold text-text-heading">
              {t('notifications.title')}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1.5 text-caption font-medium text-[var(--color-accent)] hover:underline"
              >
                <CheckCheck className="w-4 h-4" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-subtle shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-subtle rounded w-3/4" />
                      <div className="h-3 bg-subtle rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p className="text-body text-text-secondary text-center py-10 px-4">
                {t('notifications.error')}
              </p>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-subtle flex items-center justify-center">
                  <BellOff className="w-6 h-6 text-text-secondary" />
                </div>
                <p className="text-caption text-text-secondary">
                  {t('notifications.empty')}
                </p>
              </div>
            ) : (
              <ul role="list">
                {notifications.map((n) => {
                  const Icon = notificationIcon(n.type);
                  return (
                    <li key={n.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className={cn(
                          'w-full flex items-start gap-3 ps-4 pe-11 py-3 text-start transition-colors duration-150 border-b border-[var(--color-border)]/60',
                          n.is_read ? 'hover:bg-hover' : 'bg-[var(--color-accent-muted)]/25 hover:bg-[var(--color-accent-muted)]/40',
                        )}
                        role="menuitem"
                      >
                        <div
                          className={cn(
                            'shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                            n.is_read ? 'bg-subtle text-text-disabled' : notificationIconColor(n.type),
                          )}
                          aria-hidden="true"
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p dir="auto" className={cn('text-caption truncate flex-1 min-w-0', n.is_read ? 'text-text-primary' : 'font-medium text-text-heading')}>
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="shrink-0 w-2 h-2 mt-1 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                            )}
                          </div>
                          <p dir="auto" className="text-caption text-text-secondary line-clamp-2 mt-0.5">{n.body}</p>
                          <p className="text-micro text-text-disabled mt-1">
                            {formatRelativeTime(n.created_at, i18n.language)}
                          </p>
                        </div>
                      </button>
                      {/* Removes the alert only; on a computer it shows on hover. */}
                      <button
                        type="button"
                        onClick={() => remove.mutate(n.id)}
                        disabled={remove.isPending && remove.variables === n.id}
                        aria-label={t('notifications.remove', { title: n.title })}
                        title={t('notifications.removeShort')}
                        className="absolute top-2 end-2 grid place-items-center w-8 h-8 rounded-full text-text-disabled hover:text-text-primary hover:bg-subtle transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-focus-ring"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
                {hasNextPage && (
                  <li>
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="w-full py-3 text-caption font-medium text-[var(--color-accent)] hover:bg-hover transition-colors duration-150"
                    >
                      {isFetchingNextPage
                        ? t('common.loading')
                        : t('notifications.loadMore')}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {readCount > 0 && notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2 flex justify-center">
              <button
                type="button"
                onClick={() => void handleClearRead()}
                disabled={clearRead.isPending}
                className="inline-flex items-center gap-1.5 min-h-9 px-2 rounded text-caption font-medium text-text-secondary hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:shadow-focus-ring"
              >
                <Trash2 className="w-4 h-4" />
                {t('notifications.clearRead.button')}
              </button>
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
