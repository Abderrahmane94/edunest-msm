import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { apiClient } from '@/lib/api-client';

interface ChildAttendanceSummary {
  child_id: string;
  child_name: string;
  child_photo_url?: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_days: number;
  attendance_percentage: number;
}

interface ParentAttendanceResponse {
  month: string;
  children: ChildAttendanceSummary[];
}

function useParentChildrenAttendance(month: string) {
  return useQuery({
    queryKey: ['parent-attendance', month],
    queryFn: async () => {
      const res = await apiClient.get<ParentAttendanceResponse>(
        `/attendance/my-children?month=${month}`
      );
      return res.data ?? null;
    },
    enabled: !!month,
  });
}

function formatMonthYear(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function ParentAttendancePage() {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = React.useState(() => new Date());

  const month = getMonthString(currentDate);
  const { data, isLoading, isError } = useParentChildrenAttendance(month);

  const handlePreviousMonth = React.useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const handleNextMonth = React.useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  const isCurrentMonth = React.useMemo(() => {
    const now = new Date();
    return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth();
  }, [currentDate]);

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('parentAttendance.title', 'Attendance')}
          </h1>
          <p className="text-caption text-text-secondary">
            {t('parentAttendance.subtitle', 'Monthly attendance summary')}
          </p>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-4 py-6">
        {/* Month selector */}
        <div className="flex items-center justify-between mb-6 bg-card border border-border rounded-xl px-4 py-3">
          <button
            type="button"
            onClick={handlePreviousMonth}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-hover text-text-secondary hover:text-text-primary transition-colors duration-150"
            aria-label={t('parentAttendance.previousMonth', 'Previous month')}
          >
            <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
          </button>

          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-text-secondary" aria-hidden="true" />
            <span className="text-body font-medium text-text-heading capitalize">
              {formatMonthYear(currentDate, i18n.language)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150',
              isCurrentMonth
                ? 'text-text-disabled cursor-not-allowed'
                : 'hover:bg-hover text-text-secondary hover:text-text-primary'
            )}
            aria-label={t('parentAttendance.nextMonth', 'Next month')}
          >
            <ChevronRight className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-subtle" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-subtle rounded w-32" />
                    <div className="h-3 bg-subtle rounded w-20" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-16 bg-subtle rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-body text-text-secondary">
              {t('parentAttendance.error', 'Unable to load attendance data. Please try again.')}
            </p>
          </div>
        ) : data?.children && data.children.length > 0 ? (
          <div className="space-y-4">
            {data.children.map((child) => (
              <ChildAttendanceCard key={child.child_id} child={child} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-text-secondary" />
            </div>
            <p className="text-body text-text-secondary">
              {t('parentAttendance.empty', 'No attendance records for this month.')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function ChildAttendanceCard({ child }: { child: ChildAttendanceSummary }) {
  const { t } = useTranslation();

  const percentageColor = child.attendance_percentage >= 90
    ? 'text-[var(--color-success)]'
    : child.attendance_percentage >= 75
      ? 'text-[var(--color-warning)]'
      : 'text-[var(--color-danger)]';

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="p-5">
        {/* Child header */}
        <header className="flex items-center gap-3 mb-4">
          <Avatar
            src={child.child_photo_url}
            name={child.child_name}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-subsection font-semibold text-text-heading truncate">
              {child.child_name}
            </h2>
            <p className="text-caption text-text-secondary">
              {t('parentAttendance.totalDays', { count: child.total_days, defaultValue: '{{count}} school days' })}
            </p>
          </div>
          <div className="text-end">
            <p className={cn('text-section-heading font-semibold', percentageColor)}>
              {Math.round(child.attendance_percentage)}%
            </p>
            <p className="text-micro text-text-secondary">
              {t('parentAttendance.rate', 'rate')}
            </p>
          </div>
        </header>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[var(--color-success-muted)]">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">
              {child.present_count}
            </span>
            <span className="text-micro text-text-secondary">
              {t('parentAttendance.present', 'Present')}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[var(--color-danger-muted)]">
            <XCircle className="w-5 h-5 text-[var(--color-danger)]" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">
              {child.absent_count}
            </span>
            <span className="text-micro text-text-secondary">
              {t('parentAttendance.absent', 'Absent')}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[var(--color-warning-muted)]">
            <Clock className="w-5 h-5 text-[var(--color-warning)]" aria-hidden="true" />
            <span className="text-subsection font-semibold text-text-heading">
              {child.late_count}
            </span>
            <span className="text-micro text-text-secondary">
              {t('parentAttendance.late', 'Late')}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
