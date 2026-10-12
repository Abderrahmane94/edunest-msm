import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Utensils, Moon, Activity, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import { useSocket } from '@/hooks/useSocket';
import { useMessageContacts } from '@/hooks/useMessaging';
import {
  ChildChips,
  DayNav,
  MonthCalendar,
  MonthNav,
  ViewToggle,
} from '@/components/parent/PeriodPicker';
import { localToday, monthOf, type PeriodView } from '@/lib/period';

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

/** The children's reports for one month ("YYYY-MM"). */
function useParentDailyReports(month: string) {
  return useQuery({
    queryKey: ['parent-daily-reports', month],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/communication/daily-reports/my-children?month=${month}`
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
    // Today's report can arrive at any moment: always reload when the feed is
    // opened or the app comes back to the foreground (the list kept on the
    // device shows meanwhile, and offline).
    staleTime: 0,
    refetchOnWindowFocus: true,
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

/** Today's report not there yet, or no report that day. */
function NoReportCard({ name, isToday }: { name: string; isToday: boolean }) {
  const { t } = useTranslation();
  return (
    <article className="flex items-center gap-3 bg-card border border-dashed border-border rounded-2xl p-4">
      <Avatar name={name} size="md" />
      <div className="min-w-0">
        <p className="text-body font-semibold text-text-heading truncate">{name}</p>
        <p className="text-caption text-text-secondary">
          {isToday ? t('parentFeed.notYetToday') : t('parentFeed.noReportThatDay')}
        </p>
      </div>
    </article>
  );
}

/** A child's month: how many reports, moods, meals and naps, and a calendar. */
function MonthSummaryCard({
  name,
  month,
  reports,
  onSelectDay,
}: {
  name: string;
  month: string;
  reports: DailyReport[];
  onSelectDay: (date: string) => void;
}) {
  const { t } = useTranslation();
  const byDate = new Map(reports.map((r) => [r.date, r]));
  const moods = (Object.keys(MOOD_EMOJI) as Mood[])
    .map((mood) => ({ mood, count: reports.filter((r) => r.mood === mood).length }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count);
  const average = (values: number[]) =>
    values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null;
  const avgMeals = average(reports.map((r) => r.meals_eaten));
  const avgNap = average(reports.map((r) => r.nap_duration_minutes).filter((n) => n > 0));

  return (
    <article className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <header className="flex items-center gap-3">
        <Avatar name={name} size="lg" />
        <div className="min-w-0">
          <h2 className="text-subsection font-semibold text-text-heading truncate">{name}</h2>
          <p className="text-caption text-text-secondary">{t('parentFeed.reportsCount', { count: reports.length })}</p>
        </div>
      </header>

      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-subtle text-center">
            <span className="text-lg leading-5" aria-hidden="true">
              {moods.slice(0, 2).map((m) => MOOD_EMOJI[m.mood]).join(' ')}
            </span>
            <span className="text-micro text-text-secondary">{t('parentFeed.mainMood')}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-subtle text-center">
            <Utensils className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">{avgMeals ?? '—'}</span>
            <span className="text-micro text-text-secondary">{t('parentFeed.avgMeals')}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-subtle text-center">
            <Moon className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">{avgNap ?? '—'}</span>
            <span className="text-micro text-text-secondary">{t('parentFeed.avgNap')}</span>
          </div>
        </div>
      )}

      {moods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {moods.map(({ mood, count }) => (
            <span key={mood} className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1 text-caption text-text-primary">
              <span aria-hidden="true">{MOOD_EMOJI[mood]}</span>
              {t(`parentFeed.mood.${mood}`)}
              <span className="font-semibold">{count}</span>
            </span>
          ))}
        </div>
      )}

      <MonthCalendar
        month={month}
        onSelect={onSelectDay}
        renderDay={(date) => {
          const report = byDate.get(date);
          return report ? <span className="text-base" aria-hidden="true">{MOOD_EMOJI[report.mood]}</span> : null;
        }}
        dayLabel={(date) => {
          const report = byDate.get(date);
          return report ? t(`parentFeed.mood.${report.mood}`) : t('parentFeed.noReportThatDay');
        }}
      />
    </article>
  );
}

export function ParentFeedPage() {
  const { t, i18n } = useTranslation();
  const [view, setView] = React.useState<PeriodView>('day');
  const [date, setDate] = React.useState(localToday);
  const [month, setMonth] = React.useState(() => monthOf(localToday()));
  const [childFilter, setChildFilter] = React.useState<string | null>(null);

  // The day view reads the month of its day.
  const shownMonth = view === 'day' ? monthOf(date) : month;
  const { data: reports = [], isLoading, isError } = useParentDailyReports(shownMonth);
  const { data: children = [] } = useMessageContacts(true);

  // A report sent or corrected by the teacher shows up straight away.
  const { on } = useSocket();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['parent-daily-reports'] });
    const offNew = on('report:new', refresh);
    const offUpdated = on('report:updated', refresh);
    return () => {
      offNew();
      offUpdated();
    };
  }, [on, queryClient]);

  // Every child, even one without a report yet (from the reports when the
  // children list is not loaded, e.g. offline).
  const allChildren = React.useMemo(() => {
    const list = children.map((c) => ({ id: c.childId, name: `${c.firstName} ${c.lastName}`.trim() }));
    reports.forEach((r) => {
      if (!list.some((c) => c.id === r.child_id)) list.push({ id: r.child_id, name: r.child_name });
    });
    return list;
  }, [children, reports]);
  const shownChildren = childFilter ? allChildren.filter((c) => c.id === childFilter) : allChildren;

  const openDay = (day: string) => {
    setDate(day);
    setView('day');
    window.scrollTo({ top: 0 });
  };

  let content: React.ReactNode;
  if (isLoading) {
    content = Array.from({ length: 2 }).map((_, i) => (
      <div key={i} className="h-40 bg-card border border-border rounded-2xl animate-pulse" />
    ));
  } else if (isError) {
    content = <p className="text-body text-text-secondary text-center py-12">{t('parentFeed.error')}</p>;
  } else if (shownChildren.length === 0) {
    content = (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
          <FileText className="w-8 h-8 text-text-secondary" />
        </div>
        <p className="text-body text-text-secondary">{t('parentFeed.empty')}</p>
      </div>
    );
  } else if (view === 'day') {
    content = shownChildren.map((child) => {
      const report = reports.find((r) => r.child_id === child.id && r.date === date);
      return report ? (
        <ReportCard key={child.id} report={report} locale={i18n.language} />
      ) : (
        <NoReportCard key={child.id} name={child.name} isToday={date === localToday()} />
      );
    });
  } else {
    content = shownChildren.map((child) => (
      <MonthSummaryCard
        key={child.id}
        name={child.name}
        month={month}
        reports={reports.filter((r) => r.child_id === child.id)}
        onSelectDay={openDay}
      />
    ));
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-14 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-page-title font-semibold text-text-heading">{t('parentFeed.title')}</h1>
            <p className="text-caption text-text-secondary truncate">{t('parentFeed.subtitle')}</p>
          </div>
          <ViewToggle
            value={view}
            onChange={(v) => {
              if (v === 'month') setMonth(monthOf(date));
              setView(v);
            }}
          />
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-4 py-4 space-y-4">
        {view === 'day' ? <DayNav date={date} onChange={setDate} /> : <MonthNav month={month} onChange={setMonth} />}

        {/* One child or all of them */}
        {allChildren.length > 1 && (
          <ChildChips
            items={allChildren}
            value={childFilter}
            onChange={setChildFilter}
            allLabel={t('parentFeed.allChildren')}
          />
        )}

        {content}
      </main>
    </div>
  );
}
