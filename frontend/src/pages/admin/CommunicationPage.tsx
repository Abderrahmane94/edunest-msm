import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Calendar, MapPin, Users, CheckCircle, XCircle, Clock, MessageCircle, Send, ArrowLeft, Paperclip, Image, FileText, Plus } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Button,
  CreateButton,
  DataTable,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Avatar,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField } from '@/components/forms';
import { FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { useClassrooms, type Classroom } from '@/hooks/useClassrooms';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useEvents,
  useCreateEvent,
  useEventConsent,
  usePendingConversations,
  type Announcement,
  type SchoolEvent,
  type ConsentEntry,
} from '@/hooks/useCommunication';
import {
  useStaffConversations,
  useStaffMessages,
  useSendStaffMessage,
  useSendStaffFileMessage,
  useMarkStaffMessageRead,
  useGetOrCreateStaffConversation,
  useStaffColleagues,
  type StaffConversation,
  type StaffMessage,
} from '@/hooks/useStaffMessaging';

type TabMode = 'announcements' | 'events' | 'messages' | 'staff';

export function CommunicationPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TabMode>('announcements');
  const [showAnnouncementDialog, setShowAnnouncementDialog] = React.useState(false);
  const [showEventDialog, setShowEventDialog] = React.useState(false);
  const [selectedEventId, setSelectedEventId] = React.useState<string | undefined>(undefined);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('communication.title')}
        </h1>
        <div>
          {activeTab === 'announcements' && (
            <CreateButton label={t('communication.announcements.create')} onClick={() => setShowAnnouncementDialog(true)} />
          )}
          {activeTab === 'events' && (
            <CreateButton label={t('communication.events.create')} onClick={() => setShowEventDialog(true)} />
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === 'announcements' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('announcements')}
        >
          <Megaphone className="w-4 h-4" />
          {t('communication.announcements.tab')}
        </Button>
        <Button
          variant={activeTab === 'events' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('events')}
        >
          <Calendar className="w-4 h-4" />
          {t('communication.events.tab')}
        </Button>
        <Button
          variant={activeTab === 'messages' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('messages')}
        >
          <MessageCircle className="w-4 h-4" />
          {t('communication.messages.tab')}
        </Button>
        <Button
          variant={activeTab === 'staff' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setActiveTab('staff')}
        >
          <Users className="w-4 h-4" />
          {t('communication.staffMessages.tab', 'Messagerie staff')}
        </Button>
      </div>

      {/* Tab content */}
      {activeTab === 'announcements' && <AnnouncementsTab />}
      {activeTab === 'events' && (
        <EventsTab
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />
      )}
      {activeTab === 'messages' && <PendingMessagesTab />}
      {activeTab === 'staff' && <AdminStaffMessagingTab />}

      {/* Create Announcement Dialog */}
      <CreateAnnouncementDialog
        open={showAnnouncementDialog}
        onOpenChange={setShowAnnouncementDialog}
      />

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />
    </div>
  );
}

/* ─── Announcements Tab ─── */

function AnnouncementsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: announcements, isLoading } = useAnnouncements();

  const columns: Column<Announcement>[] = [
    {
      key: 'title',
      header: t('communication.announcements.columns.title'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">{row.title}</span>
      ),
    },
    {
      key: 'target',
      header: t('communication.announcements.columns.target'),
      render: (row) => (
        <span className="text-body text-text-secondary">
          {row.classroom_name || t('communication.announcements.schoolWide')}
        </span>
      ),
    },
    {
      key: 'created_by_name',
      header: t('communication.announcements.columns.createdBy'),
      render: (row) => (
        <span className="text-body text-text-secondary">{row.created_by_name}</span>
      ),
    },
    {
      key: 'published_at',
      header: t('communication.announcements.columns.publishedAt'),
      sortable: true,
      render: (row) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {formatDate(row.published_at)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-hover rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DataTable<Announcement>
      columns={columns}
      data={announcements ?? []}
      keyExtractor={(row) => row.id}
      onRowClick={(row) => navigate(`/admin/communication/announcements/${row.id}`)}
      emptyMessage={t('communication.announcements.noAnnouncements')}
    />
  );
}

/* ─── Events Tab ─── */

function EventsTab({
  selectedEventId,
  onSelectEvent,
}: {
  selectedEventId?: string;
  onSelectEvent: (id: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: events, isLoading } = useEvents();

  const columns: Column<SchoolEvent>[] = [
    {
      key: 'title',
      header: t('communication.events.columns.title'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">{row.title}</span>
      ),
    },
    {
      key: 'start_datetime',
      header: t('communication.events.columns.date'),
      sortable: true,
      render: (row) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {formatDate(row.start_datetime)}
        </span>
      ),
    },
    {
      key: 'location',
      header: t('communication.events.columns.location'),
      render: (row) => (
        <span className="text-body text-text-secondary inline-flex items-center gap-1">
          {row.location ? (
            <>
              <MapPin className="w-3 h-3" />
              {row.location}
            </>
          ) : (
            '—'
          )}
        </span>
      ),
    },
    {
      key: 'classroom',
      header: t('communication.events.columns.target'),
      render: (row) => (
        <span className="text-body text-text-secondary">
          {row.classrooms.length > 0
            ? row.classrooms.map((c) => c.name).join(', ')
            : t('communication.announcements.allSchool')}
        </span>
      ),
    },
    {
      key: 'consent',
      header: t('communication.events.columns.consent'),
      render: (row) => {
        if (!row.requires_consent) {
          return <span className="text-caption text-text-disabled">—</span>;
        }
        const stats = row.consent_stats;
        if (!stats) {
          return <StatusBadge variant="draft">{t('communication.events.noConsent')}</StatusBadge>;
        }
        return (
          <div className="flex items-center gap-2">
            <span className="text-caption text-success font-medium">{stats.approved}</span>
            <span className="text-caption text-text-disabled">/</span>
            <span className="text-caption text-warning font-medium">{stats.pending}</span>
            <span className="text-caption text-text-disabled">/</span>
            <span className="text-caption text-danger font-medium">{stats.declined}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (!row.requires_consent) return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onSelectEvent(selectedEventId === row.id ? undefined : row.id); }}
          >
            <Users className="w-4 h-4" />
            {t('communication.events.viewConsent')}
          </Button>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-hover rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTable<SchoolEvent>
        columns={columns}
        data={events ?? []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/admin/communication/events/${row.id}`)}
        emptyMessage={t('communication.events.noEvents')}
      />

      {/* Consent tracking dashboard */}
      {selectedEventId && <ConsentDashboard eventId={selectedEventId} />}
    </div>
  );
}

/* ─── Consent Dashboard ─── */

function ConsentDashboard({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { data: consents, isLoading } = useEventConsent(eventId);

  const stats = React.useMemo(() => {
    if (!consents || consents.length === 0) {
      return { total: 0, approved: 0, pending: 0, declined: 0 };
    }
    return {
      total: consents.length,
      approved: consents.filter((c) => c.status === 'approved').length,
      pending: consents.filter((c) => c.status === 'pending').length,
      declined: consents.filter((c) => c.status === 'declined').length,
    };
  }, [consents]);

  const columns: Column<ConsentEntry>[] = [
    {
      key: 'child_name',
      header: t('communication.consent.columns.child'),
      sortable: true,
      render: (row) => (
        <span className="text-body font-medium text-foreground">{row.child_name}</span>
      ),
    },
    {
      key: 'status',
      header: t('communication.consent.columns.status'),
      sortable: true,
      render: (row) => {
        const variant = row.status === 'approved' ? 'present' : row.status === 'declined' ? 'absent' : 'late';
        return (
          <StatusBadge variant={variant}>
            {t(`communication.consent.statuses.${row.status}`)}
          </StatusBadge>
        );
      },
    },
    {
      key: 'responded_at',
      header: t('communication.consent.columns.respondedAt'),
      render: (row) => (
        <span className="text-caption text-text-secondary" dir="ltr">
          {row.responded_at ? formatDate(row.responded_at) : '—'}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-hover rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h3 className="text-subsection font-semibold text-text-heading">
        {t('communication.consent.title')}
      </h3>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-subtle rounded-lg p-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-text-secondary" />
          <div>
            <p className="text-caption text-text-secondary">{t('communication.consent.total')}</p>
            <p className="text-body font-medium text-foreground">{stats.total}</p>
          </div>
        </div>
        <div className="bg-subtle rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-success" />
          <div>
            <p className="text-caption text-text-secondary">{t('communication.consent.approved')}</p>
            <p className="text-body font-medium text-success">{stats.approved}</p>
          </div>
        </div>
        <div className="bg-subtle rounded-lg p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning" />
          <div>
            <p className="text-caption text-text-secondary">{t('communication.consent.pending')}</p>
            <p className="text-body font-medium text-warning">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-subtle rounded-lg p-3 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-danger" />
          <div>
            <p className="text-caption text-text-secondary">{t('communication.consent.declined')}</p>
            <p className="text-body font-medium text-danger">{stats.declined}</p>
          </div>
        </div>
      </div>

      {/* Consent entries table */}
      <DataTable<ConsentEntry>
        columns={columns}
        data={consents ?? []}
        keyExtractor={(row) => row.child_id}
        emptyMessage={t('communication.consent.noEntries')}
      />
    </div>
  );
}

/* ─── Pending Messages Tab (Admin supervision) ─── */

function PendingMessagesTab() {
  const { t } = useTranslation();
  const { data: conversations, isLoading } = usePendingConversations();

  if (isLoading) {
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

  if (!conversations || conversations.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <MessageCircle className="w-10 h-10 text-text-disabled mx-auto mb-3" />
        <p className="text-body text-text-secondary">
          {t('communication.messages.noPending')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-caption text-text-secondary">
        {t('communication.messages.pendingHint')}
      </p>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-warning-muted flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-body font-medium text-text-primary truncate">
                {conv.teacherName} ↔ {conv.parentName}
              </p>
              <p className="text-caption text-text-secondary truncate">
                {t('communication.messages.aboutChild', { name: conv.childName })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-end">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-muted text-warning text-micro font-medium">
                {conv.unreadCount} {t('communication.messages.pending')}
              </span>
              <p className="text-micro text-text-disabled mt-0.5">
                {formatTimeAgo(conv.lastMessageAt, t)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTimeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return t('communication.messages.minutesAgo', { count: Math.max(1, diffMins) });
  if (diffHours < 24) return t('communication.messages.hoursAgo', { count: diffHours });
  return t('communication.messages.daysAgo', { count: diffDays });
}

/* ─── Create Announcement Dialog ─── */

function CreateAnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [classroomId, setClassroomId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms } = useClassrooms(activeYear?.id);

  const createAnnouncement = useCreateAnnouncement();

  const classroomOptions = [
    { value: '', label: t('communication.announcements.allSchool') },
    ...(classrooms ?? []).map((c: Classroom) => ({
      value: c.id,
      label: c.name,
    })),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setError(null);

    try {
      await createAnnouncement.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        classroom_id: classroomId || undefined,
      });
      setTitle('');
      setBody('');
      setClassroomId('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create announcement');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('communication.announcements.form.title')}</DialogTitle>
          <DialogDescription>
            {t('communication.announcements.form.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('communication.announcements.form.announcementTitle')} htmlFor="announcement-title" required>
            <Input
              id="announcement-title"
              name="announcement-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('communication.announcements.form.titlePlaceholder')}
            />
          </FormField>

          <FormField label={t('communication.announcements.form.body')} htmlFor="announcement-body" required>
            <textarea
              id="announcement-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('communication.announcements.form.bodyPlaceholder')}
              rows={4}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground placeholder:text-text-disabled focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150 resize-none"
            />
          </FormField>

          <FormSelect
            label={t('communication.announcements.form.target')}
            name="classroom"
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            options={classroomOptions}
          />

          {error && (
            <p className="text-body text-danger">{error}</p>
          )}

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!title.trim() || !body.trim() || createAnnouncement.isPending}
            >
              {createAnnouncement.isPending ? t('common.loading') : t('communication.announcements.form.publish')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Create Event Dialog ─── */

function CreateEventDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [startDatetime, setStartDatetime] = React.useState('');
  const [endDatetime, setEndDatetime] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [requiresConsent, setRequiresConsent] = React.useState(false);
  const [classroomIds, setClassroomIds] = React.useState<string[]>([]);

  const createEvent = useCreateEvent();
  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms } = useClassrooms(activeYear?.id);

  function toggleClassroom(id: string) {
    setClassroomIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startDatetime || !endDatetime) return;

    createEvent.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        location: location.trim() || undefined,
        requires_consent: requiresConsent,
        classroom_ids: classroomIds.length > 0 ? classroomIds : undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setStartDatetime('');
          setEndDatetime('');
          setLocation('');
          setRequiresConsent(false);
          setClassroomIds([]);
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('communication.events.form.title')}</DialogTitle>
          <DialogDescription>
            {t('communication.events.form.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('communication.events.form.eventTitle')} htmlFor="event-title" required>
            <Input
              id="event-title"
              name="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('communication.events.form.titlePlaceholder')}
            />
          </FormField>

          <FormField label={t('communication.events.form.eventDescription')} htmlFor="event-description" required>
            <textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('communication.events.form.descriptionPlaceholder')}
              rows={3}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground placeholder:text-text-disabled focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150 resize-none"
            />
          </FormField>

          <FormField label={t('communication.announcements.form.target')} htmlFor="event-classrooms">
            <div id="event-classrooms" className="border border-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {(classrooms ?? []).length === 0 ? (
                <p className="text-caption text-text-secondary">{t('communication.events.form.noClassrooms')}</p>
              ) : (
                (classrooms ?? []).map((c: Classroom) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={classroomIds.includes(c.id)}
                      onChange={() => toggleClassroom(c.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-body text-foreground">{c.name}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-caption text-text-secondary mt-1">
              {classroomIds.length === 0
                ? t('communication.announcements.allSchool')
                : t('communication.events.form.classroomsSelected', { count: classroomIds.length })}
            </p>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('communication.events.form.startDatetime')} htmlFor="event-start" required>
              <input
                id="event-start"
                type="datetime-local"
                value={startDatetime}
                onChange={(e) => setStartDatetime(e.target.value)}
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
              />
            </FormField>

            <FormField label={t('communication.events.form.endDatetime')} htmlFor="event-end" required>
              <input
                id="event-end"
                type="datetime-local"
                value={endDatetime}
                onChange={(e) => setEndDatetime(e.target.value)}
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground focus:outline-none focus:border-primary focus:shadow-focus-ring transition-all duration-150"
              />
            </FormField>
          </div>

          <FormField label={t('communication.events.form.location')} htmlFor="event-location">
            <Input
              id="event-location"
              name="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('communication.events.form.locationPlaceholder')}
            />
          </FormField>

          <div className="flex items-center gap-2">
            <input
              id="requires-consent"
              type="checkbox"
              checked={requiresConsent}
              onChange={(e) => setRequiresConsent(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="requires-consent" className="text-body text-foreground cursor-pointer">
              {t('communication.events.form.requiresConsent')}
            </label>
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!title.trim() || !description.trim() || !startDatetime || !endDatetime || createEvent.isPending}
            >
              {createEvent.isPending ? t('common.loading') : t('communication.events.form.createEvent')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Admin Staff Messaging Tab ─── */

function AdminStaffMessagingTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { on, joinRoom, leaveRoom } = useSocket();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messageInput, setMessageInput] = React.useState('');
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showNewDialog, setShowNewDialog] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachMenuRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useStaffConversations();
  const { data: messages = [], isLoading: messagesLoading } = useStaffMessages(activeConversationId ?? undefined);

  const sendMessage = useSendStaffMessage(activeConversationId ?? undefined);
  const sendFileMessage = useSendStaffFileMessage(activeConversationId ?? undefined);
  const markRead = useMarkStaffMessageRead();

  const activeConversation = React.useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const getOtherParticipant = React.useCallback(
    (conv: StaffConversation) =>
      conv.initiator_id === user?.id ? conv.recipient : conv.initiator,
    [user?.id],
  );

  const activeOther = activeConversation ? getOtherParticipant(activeConversation) : null;

  // Socket
  React.useEffect(() => {
    if (activeConversationId) {
      joinRoom(`staff_conversation:${activeConversationId}`);
      return () => leaveRoom(`staff_conversation:${activeConversationId}`);
    }
  }, [activeConversationId, joinRoom, leaveRoom]);

  React.useEffect(() => {
    const unsubNew = on('staff_message:new', (data: unknown) => {
      const msg = data as { conversationId: string; senderUserId: string; id: string };
      queryClient.invalidateQueries({ queryKey: ['staff-conversations'] });
      if (msg.conversationId === activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['staff-messages', activeConversationId] });
        if (msg.senderUserId !== user?.id) markRead.mutate(msg.id);
      }
    });
    const unsubRead = on('staff_message:read', () => {
      if (activeConversationId)
        queryClient.invalidateQueries({ queryKey: ['staff-messages', activeConversationId] });
    });
    return () => { unsubNew(); unsubRead(); };
  }, [on, activeConversationId, user?.id, markRead, queryClient]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const markedReadRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const unread = messages.filter(
        (m: StaffMessage) =>
          !m.is_read && m.sender_user_id !== user.id && !markedReadRef.current.has(m.id),
      );
      unread.forEach((m: StaffMessage) => {
        markedReadRef.current.add(m.id);
        markRead.mutate(m.id);
      });
    }
  }, [messages, user?.id, markRead]);

  React.useEffect(() => { markedReadRef.current.clear(); }, [activeConversationId]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node))
        setShowAttachMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = React.useCallback(() => {
    const trimmed = messageInput.trim();
    if (!trimmed || !activeConversationId) return;
    sendMessage.mutate({ content: trimmed, message_type: 'text' });
    setMessageInput('');
  }, [messageInput, activeConversationId, sendMessage]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    },
    [handleSend],
  );

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, messageType: 'photo' | 'document') => {
      const file = e.target.files?.[0];
      if (!file || !activeConversationId) return;
      sendFileMessage.mutate({ file, messageType });
      setShowAttachMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
    [activeConversationId, sendFileMessage],
  );

  // Adapt StaffMessage → MessageBubble shape
  const adaptedMessages = React.useMemo(
    () =>
      messages.map((m: StaffMessage) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_user_id: m.sender_user_id,
        content: m.content,
        message_type: m.message_type,
        cloudinary_public_id: m.cloudinary_public_id,
        file_url: m.file_url,
        is_read: m.is_read,
        created_at: m.created_at,
      })),
    [messages],
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 260px)', minHeight: '480px' }}>
      <div className="flex h-full">
        {/* Conversation list */}
        <aside className={cn(
          'w-full lg:w-72 lg:shrink-0 border-e border-border flex flex-col',
          activeConversationId ? 'hidden lg:flex' : 'flex',
        )}>
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-caption font-medium text-text-secondary">
              {t('communication.staffMessages.title', 'Messagerie enseignants')}
            </span>
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors duration-150"
              aria-label={t('communication.staffMessages.new', 'Nouvelle conversation')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-2 p-2">
                    <div className="w-8 h-8 rounded-full bg-subtle shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-subtle rounded w-3/4" />
                      <div className="h-3 bg-subtle rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 p-4 gap-2">
                <p className="text-caption text-text-secondary text-center">
                  {t('communication.staffMessages.noConversations', 'Aucune conversation')}
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewDialog(true)}
                  className="text-caption text-[var(--color-accent)] hover:underline"
                >
                  {t('communication.staffMessages.start', 'Démarrer')}
                </button>
              </div>
            ) : (
              <ul role="list" className="divide-y divide-border">
                {conversations.map((conv) => {
                  const other = getOtherParticipant(conv);
                  const fullName = `${other.firstName} ${other.lastName}`;
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => setActiveConversationId(conv.id)}
                        className={cn(
                          'w-full flex items-start gap-2.5 px-3 py-3 text-start transition-colors duration-150',
                          activeConversationId === conv.id
                            ? 'bg-[var(--color-accent-muted)]'
                            : 'hover:bg-hover',
                        )}
                      >
                        <Avatar name={fullName} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-caption font-medium text-text-primary truncate">
                              {fullName}
                            </span>
                            {conv.unread_count > 0 && (
                              <span className="shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-micro font-medium">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-micro text-text-disabled truncate">
                            {other.role === 'admin'
                              ? t('communication.staffMessages.roleAdmin', 'Directeur')
                              : t('communication.staffMessages.roleTeacher', 'Enseignant')}
                          </p>
                          {conv.last_message && (
                            <p className="text-micro text-text-secondary truncate mt-0.5">
                              {conv.last_message}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat area */}
        <main className={cn(
          'flex-1 flex flex-col min-w-0',
          !activeConversationId ? 'hidden lg:flex' : 'flex',
        )}>
          {!activeConversationId ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-body text-text-secondary">
                {t('communication.staffMessages.selectPrompt', 'Sélectionnez une conversation')}
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 bg-card border-b border-border">
                <button
                  type="button"
                  onClick={() => setActiveConversationId(null)}
                  className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-hover transition-colors"
                  aria-label={t('common.back', 'Retour')}
                >
                  <ArrowLeft className="w-4 h-4 text-text-primary rtl:rotate-180" />
                </button>
                <Avatar
                  name={activeOther ? `${activeOther.firstName} ${activeOther.lastName}` : ''}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-body font-medium text-text-primary truncate">
                    {activeOther ? `${activeOther.firstName} ${activeOther.lastName}` : ''}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {activeOther?.role === 'admin'
                      ? t('communication.staffMessages.roleAdmin', 'Directeur')
                      : t('communication.staffMessages.roleTeacher', 'Enseignant')}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5" dir="ltr">
                {messagesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={cn('animate-pulse h-8 rounded-2xl bg-subtle', i % 2 === 0 ? 'w-1/2 ms-auto' : 'w-1/2')} />
                    ))}
                  </div>
                ) : adaptedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-body text-text-secondary">
                      {t('communication.staffMessages.noMessages', 'Aucun message. Commencez !')}
                    </p>
                  </div>
                ) : (
                  adaptedMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isSent={msg.sender_user_id === user?.id}
                      i18nNamespace="messages"
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 bg-card border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <div className="relative" ref={attachMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg hover:bg-hover text-text-secondary transition-colors"
                      aria-label={t('messages.attach', 'Joindre')}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    {showAttachMenu && (
                      <div className="absolute bottom-full mb-2 start-0 bg-card border border-border rounded-lg shadow-md p-1 min-w-[150px] z-10">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors"
                        >
                          <Image className="w-4 h-4 text-text-secondary" />
                          {t('messages.sendPhoto', 'Photo')}
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-body text-text-primary hover:bg-hover transition-colors"
                        >
                          <FileText className="w-4 h-4 text-text-secondary" />
                          {t('messages.sendDocument', 'Document')}
                        </button>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('messages.placeholder', 'Écrivez un message...')}
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-[100px] bg-subtle border border-border rounded-lg px-3 py-2 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all resize-none"
                  />

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sendMessage.isPending}
                    className={cn(
                      'flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg transition-all active:scale-[0.98]',
                      messageInput.trim()
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
                        : 'bg-subtle text-text-disabled cursor-not-allowed',
                    )}
                    aria-label={t('messages.send', 'Envoyer')}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <input ref={photoInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'photo')} className="hidden" aria-hidden="true" />
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => handleFileSelect(e, 'document')} className="hidden" aria-hidden="true" />
            </>
          )}
        </main>
      </div>

      {/* New conversation dialog */}
      <AdminNewStaffConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          setActiveConversationId(id);
          setShowNewDialog(false);
        }}
      />
    </div>
  );
}

function AdminNewStaffConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data: colleagues = [], isLoading } = useStaffColleagues();
  const getOrCreate = useGetOrCreateStaffConversation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('communication.staffMessages.newTitle', 'Nouvelle conversation')}
          </DialogTitle>
          <DialogDescription>
            {t('communication.staffMessages.selectTeacher', 'Sélectionnez un enseignant pour démarrer une conversation')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-subtle rounded-lg" />
              ))}
            </div>
          ) : colleagues.length > 0 ? (
            colleagues.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  getOrCreate.mutate(c.id, {
                    onSuccess: (conv) => onConversationCreated(conv.id),
                  })
                }
                disabled={getOrCreate.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-hover hover:border-[var(--color-border-strong)] transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
              >
                <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                <div className="text-start">
                  <p className="text-body font-medium text-text-primary">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {c.role === 'admin'
                      ? t('communication.staffMessages.roleAdmin', 'Directeur')
                      : t('communication.staffMessages.roleTeacher', 'Enseignant')}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-body text-text-secondary text-center py-4">
              {t('communication.staffMessages.noTeachers', 'Aucun enseignant trouvé')}
            </p>
          )}
          {getOrCreate.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {getOrCreate.error?.message}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
