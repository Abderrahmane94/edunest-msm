import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, XCircle, Clock, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import {
  ChildChips,
  DayNav,
  MonthCalendar,
  MonthNav,
  ViewToggle,
} from '@/components/parent/PeriodPicker';
import { localToday, monthOf, type PeriodView } from '@/lib/period';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface ChildAttendanceSummary {
  child_id: string;
  child_name: string;
  child_photo_url?: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_days: number;
  attendance_percentage: number;
  /** Each marked day of the month. */
  days?: Array<{ date: string; status: AttendanceStatus; note: string | null }>;
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
    // Today's roll call can be taken at any moment.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

const STATUS_STYLE: Record<AttendanceStatus, { icon: React.ElementType; text: string; bg: string; dot: string }> = {
  present: {
    icon: CheckCircle2,
    text: 'text-[var(--color-success)]',
    bg: 'bg-[var(--color-success-muted)]',
    dot: 'bg-[var(--color-success)]',
  },
  absent: {
    icon: XCircle,
    text: 'text-[var(--color-danger)]',
    bg: 'bg-[var(--color-danger-muted)]',
    dot: 'bg-[var(--color-danger)]',
  },
  late: {
    icon: Clock,
    text: 'text-[var(--color-warning)]',
    bg: 'bg-[var(--color-warning-muted)]',
    dot: 'bg-[var(--color-warning)]',
  },
};

export function ParentAttendancePage() {
  const { t } = useTranslation();
  const [view, setView] = React.useState<PeriodView>('day');
  const [date, setDate] = React.useState(localToday);
  const [month, setMonth] = React.useState(() => monthOf(localToday()));
  const [childFilter, setChildFilter] = React.useState<string | null>(null);

  // The day view reads the month of its day.
  const { data, isLoading, isError } = useParentChildrenAttendance(view === 'day' ? monthOf(date) : month);
  const children = data?.children ?? [];
  const shownChildren = childFilter ? children.filter((c) => c.child_id === childFilter) : children;

  const openDay = (day: string) => {
    setDate(day);
    setView('day');
    window.scrollTo({ top: 0 });
  };

  let content: React.ReactNode;
  if (isLoading) {
    content = Array.from({ length: 2 }).map((_, i) => (
      <div key={i} className="h-36 bg-card border border-border rounded-2xl animate-pulse" />
    ));
  } else if (isError) {
    content = <p className="text-body text-text-secondary text-center py-12">{t('parentAttendance.error')}</p>;
  } else if (shownChildren.length === 0) {
    content = (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-subtle flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-text-secondary" />
        </div>
        <p className="text-body text-text-secondary">{t('parentAttendance.empty')}</p>
      </div>
    );
  } else if (view === 'day') {
    content = shownChildren.map((child) => (
      <ChildDayCard key={child.child_id} child={child} date={date} />
    ));
  } else {
    content = shownChildren.map((child) => (
      <ChildMonthCard key={child.child_id} child={child} month={month} onSelectDay={openDay} />
    ));
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <header className="sticky top-14 z-10 bg-card border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-page-title font-semibold text-text-heading">{t('parentAttendance.title')}</h1>
            <p className="text-caption text-text-secondary truncate">{t('parentAttendance.subtitle')}</p>
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

        {children.length > 1 && (
          <ChildChips
            items={children.map((c) => ({ id: c.child_id, name: c.child_name }))}
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

/** One child on one day: present, absent, late, or not marked. */
function ChildDayCard({ child, date }: { child: ChildAttendanceSummary; date: string }) {
  const { t } = useTranslation();
  const record = child.days?.find((d) => d.date === date);
  const style = record ? STATUS_STYLE[record.status] : null;
  const Icon = style?.icon ?? MinusCircle;

  return (
    <article className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <Avatar name={child.child_name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-text-heading truncate">{child.child_name}</p>
        {record?.note && <p className="text-caption text-text-secondary [overflow-wrap:anywhere]">{record.note}</p>}
      </div>
      <span
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold',
          style ? cn(style.bg, style.text) : 'bg-subtle text-text-secondary',
        )}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
        {record
          ? t(`parentAttendance.${record.status}`)
          : date === localToday()
            ? t('parentAttendance.notYetToday')
            : t('parentAttendance.notMarked')}
      </span>
    </article>
  );
}

/** One child's month: rate, totals and a calendar of the marked days. */
function ChildMonthCard({
  child,
  month,
  onSelectDay,
}: {
  child: ChildAttendanceSummary;
  month: string;
  onSelectDay: (date: string) => void;
}) {
  const { t } = useTranslation();
  const byDate = new Map((child.days ?? []).map((d) => [d.date, d]));

  const percentageColor =
    child.attendance_percentage >= 90
      ? 'text-[var(--color-success)]'
      : child.attendance_percentage >= 75
        ? 'text-[var(--color-warning)]'
        : 'text-[var(--color-danger)]';

  const totals: Array<{ status: AttendanceStatus; count: number }> = [
    { status: 'present', count: child.present_count },
    { status: 'absent', count: child.absent_count },
    { status: 'late', count: child.late_count },
  ];

  return (
    <article className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex items-center gap-3">
        <Avatar name={child.child_name} size="lg" />
        <div className="flex-1 min-w-0">
          <h2 className="text-subsection font-semibold text-text-heading truncate">{child.child_name}</h2>
          <p className="text-caption text-text-secondary">
            {t('parentAttendance.totalDays', { count: child.total_days, defaultValue: '{{count}} school days' })}
          </p>
        </div>
        {child.total_days > 0 && (
          <div className="text-end">
            <p className={cn('text-section font-semibold', percentageColor)}>{Math.round(child.attendance_percentage)}%</p>
            <p className="text-micro text-text-secondary">{t('parentAttendance.rate')}</p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        {totals.map(({ status, count }) => {
          const { icon: Icon, text, bg } = STATUS_STYLE[status];
          return (
            <div key={status} className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl', bg)}>
              <Icon className={cn('w-5 h-5', text)} aria-hidden="true" />
              <span className="text-subsection font-semibold text-text-heading">{count}</span>
              <span className="text-micro text-text-secondary">{t(`parentAttendance.${status}`)}</span>
            </div>
          );
        })}
      </div>

      <MonthCalendar
        month={month}
        onSelect={onSelectDay}
        renderDay={(day) => {
          const record = byDate.get(day);
          return record ? (
            <span className={cn('block w-2.5 h-2.5 rounded-full', STATUS_STYLE[record.status].dot)} aria-hidden="true" />
          ) : null;
        }}
        dayLabel={(day) => {
          const record = byDate.get(day);
          return record ? t(`parentAttendance.${record.status}`) : t('parentAttendance.notMarked');
        }}
      />
    </article>
  );
}
