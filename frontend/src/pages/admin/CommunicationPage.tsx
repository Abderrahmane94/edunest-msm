import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Calendar, Plus, MapPin, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  Button,
  DataTable,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField } from '@/components/forms';
import { FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { useClassrooms, type Classroom } from '@/hooks/useClassrooms';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useEvents,
  useCreateEvent,
  useEventConsent,
  type Announcement,
  type SchoolEvent,
  type ConsentEntry,
} from '@/hooks/useCommunication';

type TabMode = 'announcements' | 'events';

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
            <Button variant="primary" size="sm" onClick={() => setShowAnnouncementDialog(true)}>
              <Plus className="w-4 h-4" />
              {t('communication.announcements.create')}
            </Button>
          )}
          {activeTab === 'events' && (
            <Button variant="primary" size="sm" onClick={() => setShowEventDialog(true)}>
              <Plus className="w-4 h-4" />
              {t('communication.events.create')}
            </Button>
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
      </div>

      {/* Tab content */}
      {activeTab === 'announcements' && <AnnouncementsTab />}
      {activeTab === 'events' && (
        <EventsTab
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />
      )}

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
        <span className="text-caption text-text-secondary">
          {new Date(row.published_at).toLocaleDateString()}
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
        <span className="text-caption text-text-secondary">
          {new Date(row.start_datetime).toLocaleDateString()}
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
        <span className="text-caption text-text-secondary">
          {row.responded_at ? new Date(row.responded_at).toLocaleDateString() : '—'}
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

  const createEvent = useCreateEvent();

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
      },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setStartDatetime('');
          setEndDatetime('');
          setLocation('');
          setRequiresConsent(false);
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
