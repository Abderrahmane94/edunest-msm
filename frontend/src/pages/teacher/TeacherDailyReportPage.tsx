import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Plus,
  X,
  Camera,
  Minus,
  Check,
  Pencil,
  RotateCcw,
  Clock,
  CloudOff,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { useTeacherClassroom, useClassroomChildren } from '@/hooks/useTeacherClassroom';
import {
  useDailyReportsForChild,
  type Mood,
  type DailyReportSummary,
} from '@/hooks/useCommunication';
import {
  DAILY_REPORT,
  dailyReportKey,
  type DailyReportDayPayload,
} from '@/hooks/useDailyReportSync';
import {
  enqueue,
  retryAction,
  discardAction,
  dismissNotice,
  useOfflineQueue,
  type QueuedAction,
} from '@/lib/offlineQueue';

interface MoodOption {
  value: Mood;
  emoji: string;
  labelKey: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { value: 'happy', emoji: '😊', labelKey: 'dailyReport.moods.happy' },
  { value: 'sad', emoji: '😢', labelKey: 'dailyReport.moods.sad' },
  { value: 'tired', emoji: '😴', labelKey: 'dailyReport.moods.tired' },
  { value: 'excited', emoji: '🤩', labelKey: 'dailyReport.moods.excited' },
  { value: 'calm', emoji: '😌', labelKey: 'dailyReport.moods.calm' },
];

const MOOD_COLORS: Record<Mood, string> = {
  happy: 'border-[var(--color-success)] bg-[var(--color-success-muted)]',
  sad: 'border-[var(--color-danger)] bg-[var(--color-danger-muted)]',
  tired: 'border-[var(--color-warning)] bg-[var(--color-warning-muted)]',
  excited: 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]',
  calm: 'border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]',
};

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😊',
  sad: '😢',
  tired: '😴',
  excited: '🤩',
  calm: '😌',
};

interface DailyReportForm {
  child_id: string;
  date: string;
  mood: Mood | null;
  meals_eaten: number;
  nap_duration_minutes: number;
  activities: string;
  general_note: string;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getBlankForm(): Omit<DailyReportForm, 'child_id'> {
  return {
    date: getTodayString(),
    mood: null,
    meals_eaten: 0,
    nap_duration_minutes: 0,
    activities: '',
    general_note: '',
  };
}

function formatReportDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

export function TeacherDailyReportPage() {
  const { t, i18n } = useTranslation();

  // Form state
  const [form, setForm] = React.useState<DailyReportForm>({
    child_id: '',
    ...getBlankForm(),
  });
  const [editingReportId, setEditingReportId] = React.useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = React.useState<DailyReportSummary['photos']>([]);
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = React.useState<string[]>([]);
  // The form as last saved (sent or queued): unchanged since then = saved.
  const [savedSnapshot, setSavedSnapshot] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const autoLoadedChildRef = React.useRef<string | null>(null);

  // Offline, data not cached on this device stays "paused" instead of loading.
  const classroomQuery = useTeacherClassroom();
  const classroom = classroomQuery.data;
  const childrenQuery = useClassroomChildren(classroom?.id);
  const children = childrenQuery.data;

  // Report history for the selected child (past reports, and whether today's
  // report exists). Offline and not cached: no history, the form starts blank.
  const historyQuery = useDailyReportsForChild(form.child_id || undefined);
  const historyPaused = historyQuery.fetchStatus === 'paused';
  const childReports = React.useMemo(
    () => historyQuery.data ?? (historyPaused && form.child_id ? [] : undefined),
    [historyQuery.data, historyPaused, form.child_id],
  );
  const historyLoading = historyQuery.isPending && historyQuery.fetchStatus === 'fetching';

  // Reports saved on the device, waiting to be sent.
  const { actions, notices, syncing } = useOfflineQueue();
  const pendingFor = React.useCallback(
    (childId: string, date: string) =>
      actions.find((a) => a.key === dailyReportKey(childId, date)) as QueuedAction<DailyReportDayPayload> | undefined,
    [actions],
  );
  const pending = form.child_id ? pendingFor(form.child_id, form.date) : undefined;
  const notice = form.child_id ? notices.find((n) => n.key === dailyReportKey(form.child_id, form.date)) : undefined;

  // Previews of the photos waiting on the device.
  const pendingPhotoUrls = React.useMemo(
    () => (pending?.payload.photos ?? []).map((p) => ({ id: p.clientId, url: URL.createObjectURL(p.blob) })),
    [pending],
  );
  React.useEffect(() => () => pendingPhotoUrls.forEach((p) => URL.revokeObjectURL(p.url)), [pendingPhotoUrls]);

  /** The form with what's still waiting to be sent for that day on top. */
  const withPending = React.useCallback(
    (childId: string, base: Omit<DailyReportForm, 'child_id'>): DailyReportForm => {
      const queued = pendingFor(childId, base.date)?.payload;
      return queued
        ? {
            child_id: childId,
            date: base.date,
            mood: queued.mood,
            meals_eaten: queued.mealsEaten,
            nap_duration_minutes: queued.napDurationMinutes ?? 0,
            activities: queued.activities ?? '',
            general_note: queued.generalNote ?? '',
          }
        : { child_id: childId, ...base };
    },
    [pendingFor],
  );

  const loadReportIntoForm = React.useCallback((report: DailyReportSummary) => {
    setForm((prev) =>
      withPending(prev.child_id, {
        date: report.date,
        mood: report.mood,
        meals_eaten: report.meals_eaten,
        nap_duration_minutes: report.nap_duration_minutes ?? 0,
        activities: report.activities,
        general_note: report.general_note,
      }),
    );
    setEditingReportId(report.id);
    setExistingPhotos(report.photos);
    setPhotos([]);
    setPhotoPreviewUrls([]);
    setSavedSnapshot(null);
    setSaveError(null);
  }, [withPending]);

  // Once a child's history has loaded, auto-load today's report into the form
  // if one already exists (edit mode), otherwise leave the form blank (create mode).
  React.useEffect(() => {
    if (!form.child_id || !childReports) return;
    if (autoLoadedChildRef.current === form.child_id) return;
    autoLoadedChildRef.current = form.child_id;

    const todayReport = childReports.find((r) => r.date === getTodayString());
    if (todayReport) {
      loadReportIntoForm(todayReport);
    } else {
      setEditingReportId(null);
      setExistingPhotos([]);
      // A report saved offline for today shows again.
      setForm((prev) => withPending(prev.child_id, getBlankForm()));
    }
  }, [form.child_id, childReports, loadReportIntoForm, withPending]);

  // Handle photo selection
  const handlePhotoSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setPhotos((prev) => [...prev, ...files]);

      // Generate preview URLs
      const newUrls = files.map((file) => URL.createObjectURL(file));
      setPhotoPreviewUrls((prev) => [...prev, ...newUrls]);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    []
  );

  // Remove a photo
  const removePhoto = React.useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Select a child: reset the form to blank/today, the auto-load effect above
  // will then populate it if a report already exists for today.
  const selectChild = React.useCallback((childId: string) => {
    autoLoadedChildRef.current = null;
    setForm({ child_id: childId, ...getBlankForm() });
    setEditingReportId(null);
    setExistingPhotos([]);
    setPhotos([]);
    setPhotoPreviewUrls([]);
    setSavedSnapshot(null);
    setSaveError(null);
  }, []);

  // Discard the currently loaded report and start a fresh one for today.
  const startNewReport = React.useCallback(() => {
    setForm((prev) => ({ child_id: prev.child_id, ...getBlankForm() }));
    setEditingReportId(null);
    setExistingPhotos([]);
    setPhotos([]);
    setPhotoPreviewUrls([]);
    setSavedSnapshot(null);
    setSaveError(null);
  }, []);

  // Save: queued on the device with its new photos, and sent right away when
  // online (or as soon as the connection returns). The server creates or
  // updates the day's report, so a resend never duplicates it.
  const snapshot = JSON.stringify(form) + `|${photos.length}`;
  const handleSubmit = React.useCallback(async () => {
    if (!form.child_id || !form.mood) return;

    setSaveError(null);
    try {
      await enqueue<DailyReportDayPayload>(DAILY_REPORT, dailyReportKey(form.child_id, form.date), {
        childId: form.child_id,
        date: form.date,
        mood: form.mood,
        mealsEaten: form.meals_eaten,
        napDurationMinutes: form.nap_duration_minutes,
        activities: form.activities || null,
        generalNote: form.general_note || null,
        savedAt: new Date().toISOString(),
        photos: photos.map((file) => ({ clientId: crypto.randomUUID(), blob: file, name: file.name })),
      });
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setPhotos([]);
      setPhotoPreviewUrls([]);
      setSavedSnapshot(JSON.stringify(form) + '|0');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('dailyReport.submitError', 'Failed to send report. Please try again.'));
    }
  }, [form, photos, photoPreviewUrls, t]);

  // Increment/decrement helpers
  const incrementMeals = React.useCallback(() => {
    setForm((prev) => ({ ...prev, meals_eaten: Math.min(prev.meals_eaten + 1, 10) }));
  }, []);

  const decrementMeals = React.useCallback(() => {
    setForm((prev) => ({ ...prev, meals_eaten: Math.max(prev.meals_eaten - 1, 0) }));
  }, []);

  const isFetching = (q: { isPending: boolean; fetchStatus: string }) => q.isPending && q.fetchStatus === 'fetching';
  const isLoading = isFetching(classroomQuery) || isFetching(childrenQuery);
  // Offline and never loaded on this device.
  const unavailableOffline =
    (classroomQuery.isPending && classroomQuery.fetchStatus === 'paused') ||
    (!!classroom && childrenQuery.isPending && childrenQuery.fetchStatus === 'paused');
  const saved = savedSnapshot === snapshot;
  const canSubmit = !!form.child_id && !!form.mood;
  const isEditing = !!editingReportId || !!pending;
  const isEditingPastReport = !!editingReportId && form.date !== getTodayString();

  // Get selected child info
  const selectedChild = React.useMemo(
    () => children?.find((c) => c.id === form.child_id),
    [children, form.child_id]
  );

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="animate-pulse space-y-4 w-full max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-subtle rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (unavailableOffline) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <CloudOff className="w-10 h-10 text-text-disabled mx-auto" />
          <p className="text-body text-text-secondary">{t('teacherAttendance.offlineUnavailable')}</p>
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-body text-text-secondary">
            {t('dailyReport.noClassroom', 'No classroom assigned')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-14 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-subsection font-semibold text-text-heading">
            {t('dailyReport.title', 'Daily Report')}
          </h1>
          <p className="text-caption text-text-secondary">
            {classroom.name} — <span className="capitalize">{formatReportDate(form.date, i18n.language)}</span>
          </p>
        </div>
      </header>

      {/* Form content */}
      <div className="flex-1 px-4 py-5 pb-4 max-w-2xl mx-auto w-full space-y-6">
        {/* Child Selector */}
        <section>
          <label className="block text-label font-medium text-text-primary mb-2">
            {t('dailyReport.selectChild', 'Select Child')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {children && children.length > 0 ? (
              children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => selectChild(child.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 min-h-[80px] p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98]',
                    form.child_id === child.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]'
                      : 'border-border bg-card hover:border-[var(--color-border-strong)] hover:bg-hover'
                  )}
                  aria-pressed={form.child_id === child.id}
                  aria-label={`${child.first_name} ${child.last_name}`}
                >
                  <Avatar
                    src={child.photo_url}
                    name={`${child.first_name} ${child.last_name}`}
                    size="sm"
                  />
                  <span className="text-caption font-medium text-text-primary text-center leading-tight [overflow-wrap:anywhere]">
                    {child.first_name} {child.last_name ? `${child.last_name.charAt(0)}.` : ''}
                  </span>
                </button>
              ))
            ) : (
              <p className="col-span-full text-body text-text-secondary text-center py-4">
                {t('dailyReport.noChildren', 'No children in classroom')}
              </p>
            )}
          </div>
        </section>

        {/* Report History for the selected child */}
        {form.child_id && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-text-secondary" aria-hidden="true" />
              <label className="block text-label font-medium text-text-primary">
                {t('dailyReport.history', 'Previous Reports')}
              </label>
            </div>

            {historyLoading ? (
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 flex-1 bg-subtle rounded-lg animate-pulse" />
                ))}
              </div>
            ) : childReports && childReports.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {childReports.map((report) => {
                  const isActive = report.id === editingReportId;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => loadReportIntoForm(report)}
                      className={cn(
                        'flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-lg border text-start transition-all duration-150 active:scale-[0.99]',
                        isActive
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]'
                          : 'border-border bg-card hover:bg-hover'
                      )}
                      aria-pressed={isActive}
                    >
                      <span className="text-xl" role="img" aria-hidden="true">
                        {MOOD_EMOJI[report.mood]}
                      </span>
                      <span className="flex-1 text-caption font-medium text-text-primary capitalize">
                        {report.date === getTodayString()
                          ? t('dailyReport.today', "Today")
                          : formatReportDate(report.date, i18n.language)}
                      </span>
                      <Pencil className="w-3.5 h-3.5 text-text-secondary shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-caption text-text-secondary py-1">
                {t('dailyReport.noHistory', 'No previous reports for this child')}
              </p>
            )}
          </section>
        )}

        {/* Editing banner */}
        {isEditingPastReport && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 rounded-lg bg-[var(--color-accent-muted)] text-text-primary">
            <span className="text-caption font-medium">
              {t('dailyReport.editingBadge', 'Editing the report from {{date}}', {
                date: formatReportDate(form.date, i18n.language),
              })}
            </span>
            <button
              type="button"
              onClick={startNewReport}
              className="flex items-center gap-1.5 text-caption font-medium text-[var(--color-accent)] hover:underline shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('dailyReport.backToToday', "Back to today's report")}
            </button>
          </div>
        )}

        {/* Sent from the device, but the report had been changed meanwhile */}
        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2.5 text-caption text-text-primary">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="flex-1">{t('dailyReport.conflict')}</p>
            <button
              type="button"
              onClick={() => dismissNotice(notice.id)}
              className="shrink-0 text-text-secondary hover:text-text-primary"
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mood Selector */}
        <section>
          <label className="block text-label font-medium text-text-primary mb-2">
            {t('dailyReport.mood', 'Mood')}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, mood: option.value }));
                }}
                className={cn(
                  'flex flex-col items-center gap-1 min-h-[72px] p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98]',
                  form.mood === option.value
                    ? MOOD_COLORS[option.value]
                    : 'border-border bg-card hover:border-[var(--color-border-strong)]'
                )}
                aria-pressed={form.mood === option.value}
                aria-label={t(option.labelKey, option.value)}
              >
                <span className="text-2xl" role="img" aria-hidden="true">
                  {option.emoji}
                </span>
                <span className="text-micro font-medium text-text-primary">
                  {t(option.labelKey, option.value)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Meals Eaten */}
        <section>
          <label className="block text-label font-medium text-text-primary mb-2">
            {t('dailyReport.mealsEaten', 'Meals Eaten')}
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={decrementMeals}
              disabled={form.meals_eaten <= 0}
              className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-lg border border-border bg-card text-text-primary hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
              aria-label={t('dailyReport.decreaseMeals', 'Decrease meals')}
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-section font-semibold text-text-heading min-w-[40px] text-center">
              {form.meals_eaten}
            </span>
            <button
              type="button"
              onClick={incrementMeals}
              disabled={form.meals_eaten >= 10}
              className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-lg border border-border bg-card text-text-primary hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
              aria-label={t('dailyReport.increaseMeals', 'Increase meals')}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Nap Duration */}
        <section>
          <label
            htmlFor="nap-duration"
            className="block text-label font-medium text-text-primary mb-2"
          >
            {t('dailyReport.napDuration', 'Nap Duration (minutes)')}
          </label>
          <input
            id="nap-duration"
            type="number"
            min={0}
            max={300}
            value={form.nap_duration_minutes}
            onChange={(e) => {
              const val = Math.max(0, Math.min(300, parseInt(e.target.value) || 0));
              setForm((prev) => ({ ...prev, nap_duration_minutes: val }));
            }}
            className="w-full max-w-[200px] min-h-[48px] bg-card border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150"
            placeholder="0"
          />
        </section>

        {/* Activities */}
        <section>
          <label
            htmlFor="activities"
            className="block text-label font-medium text-text-primary mb-2"
          >
            {t('dailyReport.activities', 'Activities')}
          </label>
          <textarea
            id="activities"
            value={form.activities}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, activities: e.target.value }));
            }}
            rows={3}
            className="w-full min-h-[96px] bg-card border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-y"
            placeholder={t('dailyReport.activitiesPlaceholder', 'What activities did the child do today?')}
          />
        </section>

        {/* General Note */}
        <section>
          <label
            htmlFor="general-note"
            className="block text-label font-medium text-text-primary mb-2"
          >
            {t('dailyReport.generalNote', 'General Note')}
          </label>
          <textarea
            id="general-note"
            value={form.general_note}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, general_note: e.target.value }));
            }}
            rows={2}
            className="w-full min-h-[72px] bg-card border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-y"
            placeholder={t('dailyReport.generalNotePlaceholder', 'Any additional notes for the parents...')}
          />
        </section>

        {/* Existing Photos (already uploaded, read-only) */}
        {existingPhotos.length > 0 && (
          <section>
            <label className="block text-label font-medium text-text-primary mb-2">
              {t('dailyReport.existingPhotos', 'Already Uploaded')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {existingPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border"
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photos saved on the device, waiting to be sent */}
        {pendingPhotoUrls.length > 0 && (
          <section>
            <label className="flex items-center gap-1.5 text-label font-medium text-text-primary mb-2">
              <CloudOff className="w-4 h-4 text-warning" />
              {t('dailyReport.pendingPhotos')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {pendingPhotoUrls.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-dashed border-warning"
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover opacity-80" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photo Upload Grid */}
        <section>
          <label className="block text-label font-medium text-text-primary mb-2">
            {t('dailyReport.photos', 'Photos')}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {/* Photo previews */}
            {photoPreviewUrls.map((url, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden border border-border"
              >
                <img
                  src={url}
                  alt={t('dailyReport.photoAlt', `Photo ${index + 1}`)}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 end-1 flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(15,23,42,0.6)] text-[var(--color-text-inverse)] hover:bg-[rgba(15,23,42,0.8)] transition-all duration-150"
                  aria-label={t('dailyReport.removePhoto', 'Remove photo')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add photo button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1 aspect-square min-h-[80px] rounded-lg border-2 border-dashed border-[var(--color-border-strong)] bg-subtle text-text-secondary hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all duration-150 active:scale-[0.98]"
              aria-label={t('dailyReport.addPhoto', 'Add photo')}
            >
              <Camera className="w-6 h-6" />
              <span className="text-micro font-medium">
                {t('dailyReport.addPhoto', 'Add')}
              </span>
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
            aria-hidden="true"
          />
        </section>
      </div>

      {/* Fixed bottom submit button */}
      <div className="sticky bottom-[var(--tabbar-h)] lg:bottom-0 bg-card border-t border-border p-4 z-10">
        <div className="max-w-2xl mx-auto">
          {saved && pending?.error ? (
            // The server refused what was saved on the device.
            <div className="rounded-lg bg-danger-muted px-4 py-3 space-y-2">
              <p className="text-caption text-danger">{t('dailyReport.syncError', { error: pending.error })}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => retryAction(pending.id)}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-primary text-primary-foreground text-caption font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('teacherAttendance.retry')}
                </button>
                <button
                  type="button"
                  onClick={() => discardAction(pending.id)}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border bg-card text-caption font-medium text-text-secondary"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('teacherAttendance.discard')}
                </button>
              </div>
            </div>
          ) : saved && pending ? (
            // Saved on the device, waiting for the connection (or being sent).
            <div className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-lg bg-warning-muted text-text-primary text-caption font-medium text-center">
              {syncing ? (
                <RefreshCw className="w-5 h-5 shrink-0 text-warning animate-spin" />
              ) : (
                <CloudOff className="w-5 h-5 shrink-0 text-warning" />
              )}
              {syncing ? t('dailyReport.sending', 'Sending...') : t('dailyReport.savedOffline')}
            </div>
          ) : saved ? (
            <div className="flex flex-wrap items-center justify-center text-center gap-2 min-h-[48px] px-4 py-3 bg-[var(--color-success-muted)] text-[var(--color-success)] font-medium text-body rounded-lg">
              <Check className="w-5 h-5 shrink-0" />
              {isEditing
                ? t('dailyReport.updateSuccess', 'Report updated successfully!')
                : t('dailyReport.submitSuccess', 'Report sent successfully!')}
              {selectedChild && (
                <span className="text-caption opacity-80">
                  — {selectedChild.first_name} {selectedChild.last_name}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className={cn(
                'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 font-medium text-body rounded-lg transition-all duration-150 active:scale-[0.98]',
                'bg-primary text-primary-foreground hover:bg-primary-hover',
                !canSubmit && 'opacity-50 cursor-not-allowed active:scale-100'
              )}
              aria-label={isEditing ? t('dailyReport.updateReport', 'Update Report') : t('dailyReport.sendReport', 'Send Report')}
            >
              {isEditing ? <Pencil className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              {isEditing
                ? t('dailyReport.updateReport', 'Update Report')
                : t('dailyReport.sendReport', 'Send Report')}
            </button>
          )}

          {saveError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
