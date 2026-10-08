import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Calendar, MapPin, Users } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { EmptyState, PageHeader, StatusBadge, Tabs } from '@/components/ui';
import {
  useAnnouncements,
  useEvents,
  type Announcement,
  type SchoolEvent,
} from '@/hooks/useCommunication';
import { useTabParam } from '@/hooks/useTabParam';

type TabMode = 'announcements' | 'events';

export function TeacherAnnouncementsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabParam<TabMode>(['announcements', 'events'], 'announcements');

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('teacherCommunication.title')} />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'announcements', label: t('communication.announcements.tab'), icon: <Megaphone /> },
          { value: 'events', label: t('communication.events.tab'), icon: <Calendar /> },
        ]}
      />

      {activeTab === 'announcements' ? <AnnouncementsList /> : <EventsList />}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-hover rounded-md" />
        ))}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, message }: { icon: typeof Megaphone; message: string }) {
  return <EmptyState icon={<Icon />} message={message} />;
}

/* ─── Announcements ─── */

function AnnouncementsList() {
  const { t } = useTranslation();
  const { data: announcements, isLoading } = useAnnouncements();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (isLoading) return <LoadingSkeleton />;

  if (!announcements || announcements.length === 0) {
    return <Empty icon={Megaphone} message={t('communication.announcements.noAnnouncements')} />;
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <AnnouncementCard
          key={a.id}
          announcement={a}
          expanded={expandedId === a.id}
          onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
        />
      ))}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  expanded,
  onToggle,
}: {
  announcement: Announcement;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 cursor-pointer transition-all duration-150 hover:border-border-strong"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-body font-medium text-text-primary [overflow-wrap:anywhere]">{announcement.title}</h3>
            <StatusBadge variant="neutral">
              {announcement.classroom_name || t('communication.announcements.allSchool')}
            </StatusBadge>
          </div>
          <p className="text-caption text-text-secondary mt-1">
            {announcement.created_by_name} · <span dir="ltr">{formatDate(announcement.published_at)}</span>
          </p>
          {expanded && (
            <p className="text-body text-text-primary mt-3 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {announcement.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Events ─── */

function EventsList() {
  const { t } = useTranslation();
  const { data: events, isLoading } = useEvents();

  if (isLoading) return <LoadingSkeleton />;

  if (!events || events.length === 0) {
    return <Empty icon={Calendar} message={t('communication.events.noEvents')} />;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventCard({ event }: { event: SchoolEvent }) {
  const { t } = useTranslation();

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-medium text-text-primary">{event.title}</h3>
          {event.description && (
            <p className="text-body text-text-secondary mt-1 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <span className="text-caption text-text-secondary inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <bdi dir="ltr">{formatDateTime(event.start_datetime)}</bdi>
            </span>
            {event.location && (
              <span className="text-caption text-text-secondary inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {event.location}
              </span>
            )}
            {event.requires_consent && (
              <StatusBadge variant="sent">
                <Users className="w-3 h-3 me-1 inline" />
                {t('communication.events.requiresConsent')}
              </StatusBadge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
