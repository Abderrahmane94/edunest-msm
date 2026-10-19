import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatTime } from '@/lib/formatters';
import type { AttendanceHistoryEntry } from '@/hooks/useAttendance';

/** A name or a time kept in its own direction inside the sentence (Latin names in Arabic). */
const iso = (text: string) => `⁨${text}⁩`;

/** "08:12", or "20/10 08:12" for a change made on another day than the one marked. */
function when(at: string, day: string): string {
  const local = new Date(at);
  const sameDay = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}` === day;
  return iso(sameDay ? formatTime(at) : `${formatDate(at)} ${formatTime(at)}`);
}

/**
 * Who marked a child's attendance and who changed it since: one line, and the
 * whole history on a tap. For the office; parents only see the final status.
 */
export function AttendanceTrace({ entry }: { entry: AttendanceHistoryEntry }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const status = (s: string | null) => (s ? t(`attendance.statuses.${s}`) : '');
  const arrow = t('attendance.trace.arrow');
  const corrections = entry.changes.filter((c) => c.fromStatus !== null);
  const last = corrections[corrections.length - 1];

  return (
    <div className="text-caption text-text-secondary">
      <p>
        <span className="block">{t('attendance.trace.marked', { name: iso(entry.markedBy), time: when(entry.markedAt, entry.date) })}</span>
        {last && (
          <span className="block text-text-primary">
            {last.fromStatus === last.toStatus
              ? t('attendance.trace.noteChanged', { name: iso(last.byName), time: when(last.at, entry.date) })
              : t('attendance.trace.corrected', {
                  name: iso(last.byName),
                  time: when(last.at, entry.date),
                  change: `${status(last.fromStatus)} ${arrow} ${status(last.toStatus)}`,
                })}
          </span>
        )}
      </p>
      {entry.changes.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-0.5 inline-flex items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:shadow-focus-ring rounded"
        >
          <History className="w-3.5 h-3.5" />
          {t('attendance.trace.history', { count: entry.changes.length })}
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      )}
      {open && (
        <ol className="mt-1.5 space-y-1 border-s-2 border-border ps-3">
          {entry.changes.map((c, i) => (
            <li key={i}>
              <span dir="ltr" className="font-medium text-text-primary">{when(c.at, entry.date)}</span>
              {' · '}
              <span dir="auto">{c.byName}</span>
              {' '}
              <span className="text-text-disabled">({t(`attendance.trace.source.${c.source === 'teacher' ? 'teacher' : 'office'}`)})</span>
              {' : '}
              {c.fromStatus === null
                ? t('attendance.trace.firstMark', { status: status(c.toStatus) })
                : c.fromStatus !== c.toStatus
                  ? `${status(c.fromStatus)} ${arrow} ${status(c.toStatus)}`
                  : t('attendance.trace.sameStatus', { status: status(c.toStatus) })}
              {c.toNote !== c.fromNote && (
                <span dir="auto">
                  {' — '}
                  {c.toNote ? t('attendance.trace.note', { note: c.toNote }) : t('attendance.trace.noteRemoved')}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
