import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Utensils, Moon, Activity, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { apiClient } from '@/lib/api-client';

type Mood = 'happy' | 'sad' | 'tired' | 'excited' | 'calm';

interface DailyReportPhoto {
  url: string;
}

interface DailyReport {
  id: string;
  child_id: string;
  child_name: string;
  child_photo_url?: string;
  date: string;
  mood: Mood;
  meals_eaten: number;
  nap_duration_minutes: number;
  activities: string;
  general_note: string;
  photos: DailyReportPhoto[];
}

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😊',
  sad: '😢',
  tired: '😴',
  excited: '🤩',
  calm: '😌',
};

const MOOD_STRIP_COLORS: Record<Mood, string> = {
  happy: 'bg-[var(--color-success)]',
  sad: 'bg-[var(--color-danger)]',
  tired: 'bg-[var(--color-warning)]',
  excited: 'bg-[var(--color-accent)]',
  calm: 'bg-[var(--color-border-strong)]',
};

function useParentDailyReports() {
  return useQuery({
    queryKey: ['parent-daily-reports'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        '/communication/daily-reports/my-children'
      );
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw as DailyReport[];
      }
      if (raw && typeof raw === 'object' && 'daily_reports' in (raw as object)) {
        return (raw as { daily_reports: DailyReport[] }).daily_reports;
      }
      return [];
    },
  });
}

function formatDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function PhotoGrid({ photos }: { photos: DailyReportPhoto[] }) {
  if (!photos || photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {photos.map((photo, index) => (
        <div
          key={index}
          className="relative aspect-square rounded-lg overflow-hidden border border-border"
        >
          <img
            src={photo.url}
            alt={`Photo ${index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

function ReportCard({ report, locale }: { report: DailyReport; locale: string }) {
  const { t } = useTranslation();

  return (
    <article
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]"
      aria-label={t('parentFeed.reportFor', { name: report.child_name })}
    >
      {/* Mood color strip */}
      <div className={cn('h-1', MOOD_STRIP_COLORS[report.mood])} aria-hidden="true" />

      <div className="p-5">
        {/* Header: child photo + name + date + mood */}
        <header className="flex items-center gap-3 mb-4">
          <Avatar
            src={report.child_photo_url}
            name={report.child_name}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-subsection font-semibold text-text-heading truncate">
              {report.child_name}
            </h2>
            <p className="text-caption text-text-secondary capitalize">
              {formatDate(report.date, locale)}
            </p>
          </div>
        </header>

        {/* Stats row: mood, meals, nap */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div
            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-subtle text-center"
            aria-label={t(`parentFeed.mood.${report.mood}`, report.mood)}
          >
            <span className="text-xl leading-5" role="img" aria-hidden="true">
              {MOOD_EMOJI[report.mood]}
            </span>
            <span className="text-caption font-semibold text-text-heading capitalize">
              {t(`parentFeed.mood.${report.mood}`, report.mood)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-subtle text-center">
            <Utensils className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">
              {report.meals_eaten}
            </span>
            <span className="text-micro text-text-secondary">
              {t('parentFeed.meals')}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-subtle text-center">
            <Moon className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">
              {report.nap_duration_minutes ?? "—"}
            </span>
            <span className="text-micro text-text-secondary">
              {t('parentFeed.napMin')}
            </span>
          </div>
        </div>

        {/* Activities */}
        {report.activities && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-subtle mb-4">
            <Activity className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-micro text-text-secondary">{t('parentFeed.activities')}</p>
              <p className="text-body text-text-primary leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {report.activities}
              </p>
            </div>
          </div>
        )}

        {/* General note */}
        {report.general_note && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-subtle mb-4">
            <FileText className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-body text-text-primary leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {report.general_note}
            </p>
          </div>
        )}

        {/* Photo grid */}
        <PhotoGrid photos={report.photos} />
      </div>
    </article>
  );
}

export function ParentFeedPage() {
  const { t, i18n } = useTranslation();
  const { data: reports, isLoading, isError } = useParentDailyReports();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page">
        <div className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="h-1 bg-subtle" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-subtle" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-subtle rounded" />
                    <div className="h-3 w-24 bg-subtle rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-20 bg-subtle rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-body text-text-secondary">
            {t('parentFeed.error')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-14 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('parentFeed.title')}
          </h1>
          <p className="text-caption text-text-secondary">
            {t('parentFeed.subtitle')}
          </p>
        </div>
      </header>

      {/* Feed content */}
      <main className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
        {reports && reports.length > 0 ? (
          reports.map((report) => (
            <ReportCard key={report.id} report={report} locale={i18n.language} />
          ))
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
              <FileText className="w-8 h-8 text-text-secondary" />
            </div>
            <p className="text-body text-text-secondary">
              {t('parentFeed.empty')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
