import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Plus, X, Camera, Minus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { useTeacherClassroom, useClassroomChildren } from '@/hooks/useTeacherClassroom';
import { apiClient } from '@/lib/api-client';
import { useMutation } from '@tanstack/react-query';

type Mood = 'happy' | 'sad' | 'tired' | 'excited' | 'calm';

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

export function TeacherDailyReportPage() {
  const { t } = useTranslation();

  // Form state
  const [form, setForm] = React.useState<DailyReportForm>({
    child_id: '',
    date: getTodayString(),
    mood: null,
    meals_eaten: 0,
    nap_duration_minutes: 0,
    activities: '',
    general_note: '',
  });
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = React.useState<string[]>([]);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch teacher's assigned classroom
  const { data: classroom, isLoading: classroomLoading } = useTeacherClassroom();

  // Fetch children in the classroom
  const { data: children, isLoading: childrenLoading } = useClassroomChildren(classroom?.id);

  // Create daily report mutation
  const createReport = useMutation({
    mutationFn: async (data: Omit<DailyReportForm, 'mood'> & { mood: Mood }) => {
      // Map to camelCase for the backend
      const body = {
        childId: data.child_id,
        date: data.date,
        mood: data.mood,
        mealsEaten: data.meals_eaten,
        napDurationMinutes: data.nap_duration_minutes,
        activities: data.activities || undefined,
        generalNote: data.general_note || undefined,
      };
      const res = await apiClient.post<{ daily_report: { id: string } }>(
        '/communication/daily-reports',
        body
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create report');
      }
      // Handle both response shapes
      const resData = res.data as Record<string, unknown>;
      const report = (resData?.daily_report ?? resData) as { id: string };
      return report;
    },
  });

  // Upload photos mutation
  const uploadPhotos = useMutation({
    mutationFn: async ({ reportId, files }: { reportId: string; files: File[] }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('photos', file);
      });

      const res = await apiClient.uploadFile(`/communication/daily-reports/${reportId}/photos`, formData);
      if (!res.success) throw new Error(res.error?.message || 'Failed to upload photos');
      return res;
    },
  });

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

  // Handle form submission
  const handleSubmit = React.useCallback(async () => {
    if (!form.child_id || !form.mood) return;

    try {
      const report = await createReport.mutateAsync({
        child_id: form.child_id,
        date: form.date,
        mood: form.mood,
        meals_eaten: form.meals_eaten,
        nap_duration_minutes: form.nap_duration_minutes,
        activities: form.activities,
        general_note: form.general_note,
      });

      // Upload photos if any
      if (photos.length > 0 && report.id) {
        await uploadPhotos.mutateAsync({ reportId: report.id, files: photos });
      }

      setSubmitSuccess(true);

      // Reset form after short delay
      setTimeout(() => {
        setForm({
          child_id: '',
          date: getTodayString(),
          mood: null,
          meals_eaten: 0,
          nap_duration_minutes: 0,
          activities: '',
          general_note: '',
        });
        setPhotos([]);
        setPhotoPreviewUrls([]);
        setSubmitSuccess(false);
      }, 2000);
    } catch {
      // Error is handled by mutation state
    }
  }, [form, photos, createReport, uploadPhotos]);

  // Increment/decrement helpers
  const incrementMeals = React.useCallback(() => {
    setForm((prev) => ({ ...prev, meals_eaten: Math.min(prev.meals_eaten + 1, 10) }));
    setSubmitSuccess(false);
  }, []);

  const decrementMeals = React.useCallback(() => {
    setForm((prev) => ({ ...prev, meals_eaten: Math.max(prev.meals_eaten - 1, 0) }));
    setSubmitSuccess(false);
  }, []);

  const isLoading = classroomLoading || childrenLoading;
  const isSubmitting = createReport.isPending || uploadPhotos.isPending;
  const canSubmit = form.child_id && form.mood && !isSubmitting;

  // Get selected child info
  const selectedChild = React.useMemo(
    () => children?.find((c) => c.id === form.child_id),
    [children, form.child_id]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="animate-pulse space-y-4 w-full max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-subtle rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-body text-text-secondary">
            {t('dailyReport.noClassroom', 'No classroom assigned')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-subsection font-semibold text-text-heading">
            {t('dailyReport.title', 'Daily Report')}
          </h1>
          <p className="text-caption text-text-secondary">
            {classroom.name} — {form.date}
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
                  onClick={() => {
                    setForm((prev) => ({ ...prev, child_id: child.id }));
                    setSubmitSuccess(false);
                  }}
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
                  <span className="text-caption font-medium text-text-primary text-center leading-tight">
                    {child.first_name}
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

        {/* Mood Selector */}
        <section>
          <label className="block text-label font-medium text-text-primary mb-2">
            {t('dailyReport.mood', 'Mood')}
          </label>
          <div className="grid grid-cols-5 gap-2">
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, mood: option.value }));
                  setSubmitSuccess(false);
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
            <span className="text-section-heading font-semibold text-text-heading min-w-[40px] text-center">
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
              setSubmitSuccess(false);
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
              setSubmitSuccess(false);
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
              setSubmitSuccess(false);
            }}
            rows={2}
            className="w-full min-h-[72px] bg-card border border-border rounded-lg px-4 py-3 text-body text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)] transition-all duration-150 resize-y"
            placeholder={t('dailyReport.generalNotePlaceholder', 'Any additional notes for the parents...')}
          />
        </section>

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
      <div className="sticky bottom-0 bg-card border-t border-border p-4 z-10">
        <div className="max-w-2xl mx-auto">
          {submitSuccess ? (
            <div className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 bg-[var(--color-success-muted)] text-[var(--color-success)] font-medium text-body rounded-lg">
              <Check className="w-5 h-5" />
              {t('dailyReport.submitSuccess', 'Report sent successfully!')}
              {selectedChild && (
                <span className="text-caption opacity-80">
                  — {selectedChild.first_name} {selectedChild.last_name}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 font-medium text-body rounded-lg transition-all duration-150 active:scale-[0.98]',
                'bg-primary text-primary-foreground hover:bg-primary-hover',
                !canSubmit && 'opacity-50 cursor-not-allowed active:scale-100'
              )}
              aria-label={t('dailyReport.sendReport', 'Send Report')}
            >
              <Send className="w-5 h-5" />
              {isSubmitting
                ? t('dailyReport.sending', 'Sending...')
                : t('dailyReport.sendReport', 'Send Report')}
            </button>
          )}

          {createReport.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {createReport.error?.message || t('dailyReport.submitError', 'Failed to send report. Please try again.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
