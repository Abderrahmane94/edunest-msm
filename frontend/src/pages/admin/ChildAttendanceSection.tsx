import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { formatDateIn } from '@/lib/formatters';
import { useChildAttendanceHistory } from '@/hooks/useAttendance';
import { usePermissions } from '@/lib/roles';
import { AttendanceTrace } from './AttendanceTrace';

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shift(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The child's attendance in the office's child file, month by month: each
 * day's status, and who marked or changed it (the traceability).
 */
export function ChildAttendanceSection({ childId }: { childId: string }) {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const [month, setMonth] = React.useState(thisMonth);
  const allowed = can('classes', 'view');
  const { data: days = [], isLoading } = useChildAttendanceHistory(allowed ? childId : undefined, month);
  if (!allowed) return null;

  const monthLabel = formatDateIn(`${month}-01`, i18n.language, { month: 'long', year: 'numeric' });
  const isCurrent = month >= thisMonth();

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-subsection font-semibold text-text-heading">{t('children.attendance.title')}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => shift(m, -1))}
            aria-label={t('children.attendance.previous')}
            className="grid place-items-center w-8 h-8 rounded-lg text-text-secondary hover:bg-hover focus-visible:outline-none focus-visible:shadow-focus-ring"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <span className="min-w-[8.5rem] text-center text-body font-medium text-text-primary first-letter:uppercase">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shift(m, 1))}
            disabled={isCurrent}
            aria-label={t('children.attendance.next')}
            className="grid place-items-center w-8 h-8 rounded-lg text-text-secondary hover:bg-hover disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-focus-ring"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-hover rounded-md" />)}
        </div>
      ) : days.length === 0 ? (
        <p className="text-body text-text-secondary">{t('children.attendance.empty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {days.map((d) => (
            <li key={d.recordId} className="py-3 flex items-start gap-3">
              <div className="w-32 shrink-0">
                <p className="text-body font-medium text-text-primary first-letter:uppercase">
                  {formatDateIn(d.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <StatusBadge variant={d.status}>{t(`attendance.statuses.${d.status}`)}</StatusBadge>
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                {d.note && <p className="text-body text-text-secondary" dir="auto">{d.note}</p>}
                <AttendanceTrace entry={d} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
