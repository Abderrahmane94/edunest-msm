import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Megaphone, Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { StatusBadge } from '@/components/ui';
import {
  useAnnouncements,
  useEvents,
  type Announcement,
  type SchoolEvent,
} from '@/hooks/useCommunication';

type TabMode = 'announcements' | 'events';

export function ParentAnnouncementsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TabMode>('announcements');

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('parentAnnouncements.title', 'Announcements & Events')}
          </h1>
          <p className="text-caption text-text-secondary">
            {t('parentAnnouncements.subtitle', "What's happening at school")}
          </p>
        </div>
        <div className="max-w-[600px] mx-auto px-4">
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </header>

      {/* Feed content */}
      <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
        {activeTab === 'announcements' ? <AnnouncementsFeed /> : <EventsFeed />}
      </main>
    </div>
  );
}

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabMode;
  onTabChange: (tab: TabMode) => void;
}) {
  const { t } = useTranslation();
  const tabs: { id: TabMode; label: string; icon: typeof Megaphone }[] = [
    { id: 'announcements', label: t('communication.announcements.tab'), icon: Megaphone },
    { id: 'events', label: t('communication.events.tab'), icon: Calendar },
  ];

  return (
    <div className="flex items-center gap-1" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-body font-medium border-b-2 transition-all duration-150 ${
              isActive
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyFeed({ icon: Icon, message }: { icon: typeof Megaphone; message: string }) {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
        <Icon className="w-8 h-8 text-text-secondary" />
      </div>
      <p className="text-body text-text-secondary">{message}</p>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse space-y-3">
          <div className="h-4 w-2/3 bg-subtle rounded" />
          <div className="h-3 w-1/3 bg-subtle rounded" />
          <div className="h-16 bg-subtle rounded-lg" />
        </div>
      ))}
    </>
  );
}

/* ─── Announcements ─── */

function AnnouncementsFeed() {
  const { t } = useTranslation();
  const { data: announcements, isLoading, isError } = useAnnouncements();

  if (isLoading) return <FeedSkeleton />;

  if (isError) {
    return (
      <p className="text-body text-text-secondary text-center py-8">
        {t('parentAnnouncements.error', 'Unable to load announcements. Please try again.')}
      </p>
    );
  }

  if (!announcements || announcements.length === 0) {
    return <EmptyFeed icon={Megaphone} message={t('communication.announcements.noAnnouncements')} />;
  }

  return (
    <>
      {announcements.map((a) => (
        <AnnouncementCard key={a.id} announcement={a} />
      ))}
    </>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const { t } = useTranslation();

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4 text-[var(--color-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-subsection font-semibold text-text-heading truncate">{announcement.title}</h2>
          <p className="text-micro text-text-secondary">
            {announcement.classroom_name || t('communication.announcements.allSchool')} ·{' '}
            <span dir="ltr">{formatDate(announcement.published_at)}</span>
          </p>
        </div>
      </div>
      <p className="text-body text-text-primary leading-relaxed whitespace-pre-wrap">{announcement.body}</p>
    </article>
  );
}

/* ─── Events ─── */

function EventsFeed() {
  const { t } = useTranslation();
  const { data: events, isLoading, isError } = useEvents();

  if (isLoading) return <FeedSkeleton />;

  if (isError) {
    return (
      <p className="text-body text-text-secondary text-center py-8">
        {t('parentAnnouncements.error', 'Unable to load announcements. Please try again.')}
      </p>
    );
  }

  if (!events || events.length === 0) {
    return <EmptyFeed icon={Calendar} message={t('communication.events.noEvents')} />;
  }

  return (
    <>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </>
  );
}

function EventCard({ event }: { event: SchoolEvent }) {
  const { t } = useTranslation();

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-[var(--color-warning-muted)] flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4 text-[var(--color-warning)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-subsection font-semibold text-text-heading truncate">{event.title}</h2>
          <p className="text-micro text-text-secondary" dir="ltr">
            {formatDateTime(event.start_datetime)}
          </p>
        </div>
      </div>

      {event.description && (
        <p className="text-body text-text-primary leading-relaxed mb-3">{event.description}</p>
      )}

      {event.location && (
        <p className="text-caption text-text-secondary inline-flex items-center gap-1 mb-3">
          <MapPin className="w-3.5 h-3.5" />
          {event.location}
        </p>
      )}

      {event.requires_consent && (
        <div className="flex items-center justify-between gap-3 mt-2 pt-3 border-t border-border">
          <StatusBadge variant="sent">
            <Users className="w-3 h-3 me-1 inline" />
            {t('communication.events.requiresConsent')}
          </StatusBadge>
          <Link
            to="/parent/invoices?tab=consent"
            className="text-caption font-medium text-[var(--color-accent)] inline-flex items-center gap-1 hover:underline"
          >
            {t('parentAnnouncements.respondToConsent', 'Respond')}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </article>
  );
}
