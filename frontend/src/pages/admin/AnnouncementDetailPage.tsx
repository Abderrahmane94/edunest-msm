import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/formatters';
import { ArrowLeft, Megaphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAnnouncement, useDeleteAnnouncement } from '@/hooks/useCommunication';

export function AnnouncementDetailPage() {
  const { t } = useTranslation();
  const { announcementId } = useParams<{ announcementId: string }>();
  const navigate = useNavigate();

  const { data: announcement, isLoading } = useAnnouncement(announcementId!);
  const deleteAnnouncement = useDeleteAnnouncement();

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteAnnouncement.mutateAsync(announcementId!);
      navigate('/admin/communication');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('common.error'));
      setConfirmDelete(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
          <div className="h-6 bg-hover rounded-md w-1/2" />
          <div className="h-32 bg-hover rounded-md" />
        </div>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/communication')}>
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <p className="text-body text-danger">{t('communication.announcements.notFound')}</p>
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
          <Megaphone className="w-5 h-5 text-primary" />
          <h1 className="text-page-title font-semibold text-text-heading">{announcement.title}</h1>
        </div>
      </div>

      {/* Content card */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4 text-caption text-text-secondary">
          <span>{t('communication.announcements.columns.createdBy')}: <span className="text-foreground font-medium">{announcement.created_by_name}</span></span>
          <span>·</span>
          <span>{t('communication.announcements.columns.publishedAt')}: <span className="text-foreground" dir="ltr">{formatDate(announcement.published_at)}</span></span>
          {announcement.classroom_name && (
            <>
              <span>·</span>
              <span>{t('communication.announcements.columns.target')}: <span className="text-foreground">{announcement.classroom_name}</span></span>
            </>
          )}
        </div>
        <div className="prose prose-sm max-w-none">
          <p className="text-body text-foreground whitespace-pre-wrap">{announcement.body}</p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-border border-danger/30 rounded-lg p-6 space-y-3">
        <h2 className="text-subsection font-semibold text-danger">{t('communication.detail.dangerZone')}</h2>
        <p className="text-body text-text-secondary">{t('communication.detail.deleteAnnouncementWarning')}</p>
        {deleteError && <p className="text-body text-danger">{deleteError}</p>}
        {!confirmDelete ? (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="border-danger text-danger hover:bg-danger/10">
            <Trash2 className="w-4 h-4" />
            {t('communication.detail.deleteAnnouncement')}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-body text-danger font-medium">{t('communication.detail.confirmDelete')}</p>
            <Button variant="secondary" onClick={handleDelete} disabled={deleteAnnouncement.isPending} className="border-danger text-danger hover:bg-danger/10">
              {deleteAnnouncement.isPending ? t('common.loading') : t('common.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
