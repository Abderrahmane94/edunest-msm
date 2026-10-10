import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, X, CheckCheck, Send, CloudOff, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Avatar, Input, useConfirm } from '@/components/ui';
import { useTeacherClassroom, useClassroomChildren } from '@/hooks/useTeacherClassroom';
import {
  useClassroomAttendance,
  ATTENDANCE_DAY,
  attendanceDayKey,
  type AttendanceRecord,
  type AttendanceStatus,
  type AttendanceDayPayload,
  type AttendanceSyncNotice,
} from '@/hooks/useAttendance';
import {
  enqueue,
  retryAction,
  discardAction,
  dismissNotice,
  useOfflineQueue,
  type QueuedAction,
} from '@/lib/offlineQueue';

interface ChildAttendanceState {
  child_id: string;
  status: AttendanceStatus | null;
  note?: string;
  /** Set when the teacher marks the child here: only these are sent. */
  markedAt?: string;
}

/** How a marked child's card shows its status: colour, side band, avatar badge. */
const STATUS_LOOK: Record<AttendanceStatus, { color: string; bg: string; band: string; icon: React.ElementType }> = {
  present: {
    color: 'text-[var(--color-present)]',
    bg: 'bg-[var(--color-present)]',
    band: 'border-s-[var(--color-present)]',
    icon: Check,
  },
  late: { color: 'text-[var(--color-late)]', bg: 'bg-[var(--color-late)]', band: 'border-s-[var(--color-late)]', icon: Clock },
  absent: {
    color: 'text-[var(--color-absent)]',
    bg: 'bg-[var(--color-absent)]',
    band: 'border-s-[var(--color-absent)]',
    icon: X,
  },
};

/** A tap the card answers visually: `n` restarts the animation, `delay` staggers "all present". */
interface MarkBump {
  n: number;
  delay: number;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Daily attendance for the teacher's classroom. Works offline: attendance is
 * saved on the device and sent when the connection returns (see
 * lib/offlineQueue); what's waiting is shown on the children concerned.
 */
export function TeacherAttendancePage() {
  const { t } = useTranslation();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [selectedDate, setSelectedDate] = React.useState<string>(getTodayString());
  const [attendanceMap, setAttendanceMap] = React.useState<Map<string, ChildAttendanceState>>(
    new Map()
  );
  // Marks not yet saved (sent or queued) since the last save.
  const [hasChanges, setHasChanges] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Offline, data not cached on this device stays "paused" instead of loading.
  const classroomQuery = useTeacherClassroom();
  const classroom = classroomQuery.data;
  const childrenQuery = useClassroomChildren(classroom?.id);
  const children = childrenQuery.data;
  const recordsQuery = useClassroomAttendance(classroom?.id, selectedDate);
  // A day not cached offline starts empty: the teacher can still mark it.
  const existingRecords = recordsQuery.data;

  const { actions, notices, syncing } = useOfflineQueue();
  const dayKey = classroom ? attendanceDayKey(classroom.id, selectedDate) : null;
  const pending = actions.find((a) => a.key === dayKey) as QueuedAction<AttendanceDayPayload> | undefined;
  const notice = notices.find((n) => n.key === dayKey);
  const pendingChildIds = React.useMemo(
    () => new Set(pending?.payload.records.map((r) => r.childId) ?? []),
    [pending],
  );

  // Initialize from the saved records, with anything still waiting to be sent on top.
  React.useEffect(() => {
    if (!children) return;

    const newMap = new Map<string, ChildAttendanceState>();
    children.forEach((child) => {
      const existing = existingRecords?.find((r: AttendanceRecord) => r.childId === child.id);
      const queued = pending?.payload.records.find((r) => r.childId === child.id);
      newMap.set(child.id, {
        child_id: child.id,
        status: queued?.status ?? existing?.status ?? null,
        note: queued?.note ?? existing?.note ?? undefined,
        markedAt: queued?.markedAt,
      });
    });
    setAttendanceMap(newMap);
    setHasChanges(false);
  }, [children, existingRecords, pending]);

  // A new day starts fresh.
  React.useEffect(() => {
    setSubmitted(false);
    setSaveError(null);
  }, [selectedDate]);

  // Cards the teacher just marked, to play their animation (not on load).
  const [bumps, setBumps] = React.useState<Record<string, MarkBump>>({});

  // Mark a single child's attendance
  const markChild = React.useCallback((childId: string, status: AttendanceStatus) => {
    setBumps((prev) => ({ ...prev, [childId]: { n: (prev[childId]?.n ?? 0) + 1, delay: 0 } }));
    setAttendanceMap((prev) => {
      const next = new Map(prev);
      const current = next.get(childId);
      if (current) {
        next.set(childId, { ...current, status, markedAt: new Date().toISOString() });
      }
      return next;
    });
    setHasChanges(true);
    setSubmitted(false);
  }, []);

  // Mark all children as present
  const markAllPresent = React.useCallback(() => {
    const now = new Date().toISOString();
    // The cards light up one after the other, top to bottom.
    setBumps((prev) => {
      const next = { ...prev };
      (children ?? []).forEach((child, i) => {
        next[child.id] = { n: (prev[child.id]?.n ?? 0) + 1, delay: Math.min(i, 12) * 45 };
      });
      return next;
    });
    setAttendanceMap((prev) => {
      const next = new Map(prev);
      next.forEach((value, key) => {
        next.set(key, { ...value, status: 'present', markedAt: now });
      });
      return next;
    });
    setHasChanges(true);
    setSubmitted(false);
  }, [children]);

  // Save: queued on the device and sent right away when online (or as soon
  // as the connection returns).
  const handleSubmit = React.useCallback(async () => {
    if (!classroom || !dayKey) return;

    const records = Array.from(attendanceMap.values())
      .filter((r): r is ChildAttendanceState & { status: AttendanceStatus; markedAt: string } =>
        r.status !== null && !!r.markedAt,
      )
      .map((r) => ({ childId: r.child_id, status: r.status, note: r.note, markedAt: r.markedAt }));
    if (records.length === 0) return;

    setSaveError(null);
    try {
      await enqueue<AttendanceDayPayload>(ATTENDANCE_DAY, dayKey, {
        classroomId: classroom.id,
        date: selectedDate,
        records,
      });
      setHasChanges(false);
      setSubmitted(true);
    } catch (err) {
      setSaveError(errorMessage(err, t));
    }
  }, [classroom, dayKey, attendanceMap, selectedDate, t]);

  // Count stats
  const stats = React.useMemo(() => {
    const values = Array.from(attendanceMap.values());
    const total = values.length;
    const marked = values.filter((v) => v.status !== null).length;
    const present = values.filter((v) => v.status === 'present').length;
    const absent = values.filter((v) => v.status === 'absent').length;
    const late = values.filter((v) => v.status === 'late').length;
    return { total, marked, present, absent, late };
  }, [attendanceMap]);

  const isFetching = (q: { isPending: boolean; fetchStatus: string }) => q.isPending && q.fetchStatus === 'fetching';
  const isLoading = isFetching(classroomQuery) || isFetching(childrenQuery) || isFetching(recordsQuery);
  // Offline and never loaded on this device.
  const unavailableOffline =
    (classroomQuery.isPending && classroomQuery.fetchStatus === 'paused') ||
    (!!classroom && childrenQuery.isPending && childrenQuery.fetchStatus === 'paused');
  const hasMarks = Array.from(attendanceMap.values()).some((r) => r.status !== null && r.markedAt);

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
            {t('teacherAttendance.noClassroom')}
          </p>
        </div>
      </div>
    );
  }

  const childName = (id: string) => {
    const child = children?.find((c) => c.id === id);
    return child ? `${child.first_name} ${child.last_name}` : '';
  };
  const skipped = (notice?.data as AttendanceSyncNotice | undefined)?.skipped ?? [];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-14 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-subsection font-semibold text-text-heading">
                {t('teacherAttendance.title')}
              </h1>
              <p className="text-caption text-text-secondary">
                {classroom.name} — {classroom.level}
              </p>
            </div>
            <div className="w-36">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label={t('teacherAttendance.selectDate')}
              />
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-caption">
            <span className="text-text-secondary">
              {stats.marked}/{stats.total} {t('teacherAttendance.marked')}
            </span>
            {stats.present > 0 && (
              <span className="text-[var(--color-present)]">
                {stats.present} {t('attendance.statuses.present')}
              </span>
            )}
            {stats.late > 0 && (
              <span className="text-[var(--color-late)]">
                {stats.late} {t('attendance.statuses.late')}
              </span>
            )}
            {stats.absent > 0 && (
              <span className="text-[var(--color-absent)]">
                {stats.absent} {t('attendance.statuses.absent')}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Sent from the device, but some children had been changed meanwhile */}
      {skipped.length > 0 && notice && (
        <div className="px-4 pt-3 max-w-2xl mx-auto w-full">
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2.5 text-caption text-text-primary">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="flex-1">
              {t('teacherAttendance.conflict', { date: formatDate(selectedDate) })}{' '}
              <span className="font-medium">{skipped.map(childName).filter(Boolean).join(', ')}</span>
            </p>
            <button
              type="button"
              onClick={() => dismissNotice(notice.id)}
              className="shrink-0 text-text-secondary hover:text-text-primary"
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick action: Mark all present */}
      <div className="px-4 py-3 max-w-2xl mx-auto w-full">
        <button
          type="button"
          onClick={markAllPresent}
          className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 bg-[var(--color-success-muted)] text-[var(--color-success)] font-medium text-body rounded-lg border border-[var(--color-success)] border-opacity-20 hover:bg-[var(--color-success)] hover:text-[var(--color-text-inverse)] transition-all duration-150 active:scale-[0.98]"
          aria-label={t('teacherAttendance.markAllPresent')}
        >
          <CheckCheck className="w-5 h-5" />
          {t('teacherAttendance.markAllPresent')}
        </button>
      </div>

      {/* Children list */}
      <div className="flex-1 px-4 pb-4 max-w-2xl mx-auto w-full">
        <div className="space-y-3">
          {children && children.length > 0 ? (
            children.map((child) => {
              const state = attendanceMap.get(child.id);
              const currentStatus = state?.status ?? null;
              const look = currentStatus ? STATUS_LOOK[currentStatus] : null;
              // Only cards the teacher just marked animate (not on load).
              const bump = currentStatus ? bumps[child.id] : undefined;
              const delay = bump ? { animationDelay: `${bump.delay}ms` } : undefined;
              const BadgeIcon = look?.icon;

              return (
                <div
                  key={child.id}
                  className={cn(
                    'relative bg-card border rounded-lg p-4 transition-colors duration-200',
                    currentStatus === 'present' && 'border-[var(--color-present)] border-opacity-50',
                    currentStatus === 'late' && 'border-[var(--color-late)] border-opacity-50',
                    currentStatus === 'absent' && 'border-[var(--color-absent)] border-opacity-50',
                    look && ['border-s-4', look.band],
                    !currentStatus && 'border-border'
                  )}
                >
                  {/* Halo in the status colour, replayed on each tap */}
                  {bump && look && (
                    <span
                      key={bump.n}
                      aria-hidden="true"
                      className={cn('pointer-events-none absolute inset-0 rounded-lg animate-mark-halo', look.color)}
                      style={delay}
                    />
                  )}

                  {/* Child info */}
                  <div className="flex items-center gap-3 mb-3">
                    {/* Keyed on the tap so the pop replays; the buttons keep their focus. */}
                    <div
                      key={bump?.n ?? 0}
                      className={cn('relative shrink-0', bump && 'animate-mark-pop')}
                      style={delay}
                    >
                      <Avatar
                        src={child.photo_url}
                        name={`${child.first_name} ${child.last_name}`}
                        size="md"
                      />
                      {look && BadgeIcon && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute -bottom-1 -end-1 grid place-items-center w-5 h-5 rounded-full ring-2 ring-card text-[var(--color-text-inverse)]',
                            look.bg,
                            bump && 'animate-badge-pop',
                          )}
                          style={delay}
                        >
                          <BadgeIcon className="w-3 h-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-body font-medium text-text-heading [overflow-wrap:anywhere]">
                        {child.first_name} {child.last_name}
                      </p>
                      {pendingChildIds.has(child.id) && (
                        <p className="inline-flex items-center gap-1 text-micro font-medium text-warning">
                          <CloudOff className="w-3 h-3" />
                          {t('teacherAttendance.pendingBadge')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status buttons - large tap targets */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => markChild(child.id, 'present')}
                      className={cn(
                        'flex items-center justify-center gap-2 min-h-[48px] px-3 py-3 rounded-lg font-medium text-label transition-all duration-150 active:scale-[0.98]',
                        currentStatus === 'present'
                          ? 'bg-[var(--color-success)] text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-[var(--color-text-inverse)]'
                      )}
                      aria-label={`${t('attendance.statuses.present')} - ${child.first_name} ${child.last_name}`}
                      aria-pressed={currentStatus === 'present'}
                    >
                      <Check className="w-5 h-5" />
                      <span className="hidden sm:inline">{t('attendance.statuses.present')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => markChild(child.id, 'late')}
                      className={cn(
                        'flex items-center justify-center gap-2 min-h-[48px] px-3 py-3 rounded-lg font-medium text-label transition-all duration-150 active:scale-[0.98]',
                        currentStatus === 'late'
                          ? 'bg-[var(--color-warning)] text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-[var(--color-text-inverse)]'
                      )}
                      aria-label={`${t('attendance.statuses.late')} - ${child.first_name} ${child.last_name}`}
                      aria-pressed={currentStatus === 'late'}
                    >
                      <Clock className="w-5 h-5" />
                      <span className="hidden sm:inline">{t('attendance.statuses.late')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => markChild(child.id, 'absent')}
                      className={cn(
                        'flex items-center justify-center gap-2 min-h-[48px] px-3 py-3 rounded-lg font-medium text-label transition-all duration-150 active:scale-[0.98]',
                        currentStatus === 'absent'
                          ? 'bg-[var(--color-danger)] text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-[var(--color-text-inverse)]'
                      )}
                      aria-label={`${t('attendance.statuses.absent')} - ${child.first_name} ${child.last_name}`}
                      aria-pressed={currentStatus === 'absent'}
                    >
                      <X className="w-5 h-5" />
                      <span className="hidden sm:inline">{t('attendance.statuses.absent')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <p className="text-body text-text-secondary">
                {t('teacherAttendance.noChildren')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom submit button */}
      <div className="sticky bottom-[var(--tabbar-h)] lg:bottom-0 bg-card border-t border-border p-4 z-10">
        <div className="max-w-2xl mx-auto space-y-2">
          {!hasChanges && pending?.error ? (
            // The server refused what was saved on the device.
            <div className="rounded-lg bg-danger-muted px-4 py-3 space-y-2">
              <p className="text-caption text-danger">
                {t('teacherAttendance.syncError', { error: errorMessage(pending.error, t) })}
              </p>
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
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('confirmations.discard.attendanceTitle'),
                      description: t('confirmations.discard.attendanceDescription'),
                      confirmLabel: t('teacherAttendance.discard'),
                    });
                    if (ok) discardAction(pending.id);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border bg-card text-caption font-medium text-text-secondary"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('teacherAttendance.discard')}
                </button>
                {confirmDialog}
              </div>
            </div>
          ) : !hasChanges && pending ? (
            // Saved on the device, waiting for the connection (or being sent).
            <div className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-lg bg-warning-muted text-text-primary text-caption font-medium text-center">
              {syncing ? (
                <RefreshCw className="w-5 h-5 shrink-0 text-warning animate-spin" />
              ) : (
                <CloudOff className="w-5 h-5 shrink-0 text-warning" />
              )}
              {syncing ? t('teacherAttendance.sending') : t('teacherAttendance.savedOffline')}
            </div>
          ) : !hasChanges && submitted ? (
            <div className="flex flex-wrap items-center justify-center text-center gap-2 min-h-[48px] px-4 py-3 bg-[var(--color-success-muted)] text-[var(--color-success)] font-medium text-body rounded-lg">
              <Check className="w-5 h-5" />
              {t('teacherAttendance.submitSuccess')}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!hasMarks}
              className={cn(
                'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 font-medium text-body rounded-lg transition-all duration-150 active:scale-[0.98]',
                'bg-primary text-primary-foreground hover:bg-primary-hover',
                !hasMarks && 'opacity-50 cursor-not-allowed active:scale-100'
              )}
              aria-label={t('teacherAttendance.submit')}
            >
              <Send className="w-5 h-5" />
              {t('teacherAttendance.submit')}
              {stats.marked > 0 && (
                <span className="text-caption opacity-80">
                  ({stats.marked}/{stats.total})
                </span>
              )}
            </button>
          )}

          {saveError && (
            <p className="text-caption text-[var(--color-danger)] text-center">
              {saveError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
