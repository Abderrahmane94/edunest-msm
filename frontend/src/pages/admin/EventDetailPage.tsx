import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/lib/formatters';
import { ArrowLeft, Calendar, MapPin, Users, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react';
import { Button, StatusBadge } from '@/components/ui';
import { useEvent, useDeleteEvent, useEventConsent } from '@/hooks/useCommunication';

export function EventDetailPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading } = useEvent(eventId!);
  const { data: consents } = useEventConsent(eventId);
  const deleteEvent = useDeleteEvent();

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteEvent.mutateAsync(eventId!);
      navigate('/admin/communication');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('common.error'));
      setConfirmDelete(false);
    }
  }

  const stats = React.useMemo(() => {
    if (!consents || consents.length === 0) return { total: 0, approved: 0, pending: 0, declined: 0 };
    return {
      total: consents.length,
      approved: consents.filter((c) => c.status === 'approved').length,
      pending: consents.filter((c) => c.status === 'pending').length,
      declined: consents.filter((c) => c.status === 'declined').length,
    };
  }, [consents]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-6 bg-hover rounded-md w-1/2" />
          <div className="h-20 bg-hover rounded-md" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/communication')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('communication.events.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/communication')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-5 h-5 text-primary" />
          <h1 className="text-page-title font-semibold text-text-heading">{event.title}</h1>
        </div>
        {event.requires_consent && (
          <StatusBadge variant="sent">{t('communication.events.requiresConsent')}</StatusBadge>
        )}
      </div>

      {/* Event details */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body">
          <div className="flex items-center gap-2 text-text-secondary">
            <Calendar className="w-4 h-4 shrink-0" />
            <div>
              <p className="text-caption text-text-secondary">{t('communication.events.form.startDatetime')}</p>
              <p className="text-body text-foreground" dir="ltr">{formatDateTime(event.start_datetime)}</p>
            </div>
          </div>
          {event.end_datetime && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0 text-text-secondary" />
              <div>
                <p className="text-caption text-text-secondary">{t('communication.events.form.endDatetime')}</p>
                <p className="text-body text-foreground" dir="ltr">{formatDateTime(event.end_datetime)}</p>
              </div>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-text-secondary" />
              <div>
                <p className="text-caption text-text-secondary">{t('communication.events.form.location')}</p>
                <p className="text-body text-foreground">{event.location}</p>
              </div>
            </div>
          )}
        </div>
        {event.description && (
          <p className="text-body text-foreground whitespace-pre-wrap pt-2 border-t border-border">{event.description}</p>
        )}
      </div>

      {/* Consent tracking */}
      {event.requires_consent && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-subsection font-semibold text-text-heading">{t('communication.consent.title')}</h2>
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

          {(consents ?? []).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              {consents!.map((entry) => {
                const variant = entry.status === 'approved' ? 'present' : entry.status === 'declined' ? 'absent' : 'late';
                return (
                  <div key={entry.child_id} className="flex items-center justify-between">
                    <span className="text-body text-foreground">{entry.child_name}</span>
                    <StatusBadge variant={variant}>
                      {t(`communication.consent.statuses.${entry.status}`)}
                    </StatusBadge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-danger">{t('communication.detail.dangerZone')}</h2>
        <p className="text-body text-text-secondary">{t('communication.detail.deleteEventWarning')}</p>
        {deleteError && <p className="text-body text-danger">{deleteError}</p>}
        {!confirmDelete ? (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="border-danger text-danger hover:bg-danger/10">
            <Trash2 className="w-4 h-4" />
            {t('communication.detail.deleteEvent')}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-body text-danger font-medium">{t('communication.detail.confirmDelete')}</p>
            <Button variant="secondary" onClick={handleDelete} disabled={deleteEvent.isPending} className="border-danger text-danger hover:bg-danger/10">
              {deleteEvent.isPending ? t('common.loading') : t('common.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
