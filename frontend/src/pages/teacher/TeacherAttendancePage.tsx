import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, X, CheckCheck, Send, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { useTeacherClassroom, useClassroomChildren } from '@/hooks/useTeacherClassroom';
import {
  useClassroomAttendance,
  useBulkMarkAttendance,
  type AttendanceRecord,
} from '@/hooks/useAttendance';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface ChildAttendanceState {
  child_id: string;
  status: AttendanceStatus | null;
  note?: string;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function TeacherAttendancePage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = React.useState<string>(getTodayString());
  const [attendanceMap, setAttendanceMap] = React.useState<Map<string, ChildAttendanceState>>(
    new Map()
  );
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  // Fetch teacher's assigned classroom
  const { data: classroom, isLoading: classroomLoading } = useTeacherClassroom();

  // Fetch children in the classroom
  const { data: children, isLoading: childrenLoading } = useClassroomChildren(classroom?.id);

  // Fetch existing attendance records for the selected date
  const { data: existingRecords, isLoading: recordsLoading } = useClassroomAttendance(
    classroom?.id,
    selectedDate
  );

  // Bulk mark mutation
  const bulkMark = useBulkMarkAttendance();

  const justSubmittedRef = React.useRef(false);

  // Initialize attendance map when children or existing records change
  React.useEffect(() => {
    if (!children) return;

    const newMap = new Map<string, ChildAttendanceState>();
    children.forEach((child) => {
      const existing = existingRecords?.find((r: AttendanceRecord) => r.childId === child.id);
      newMap.set(child.id, {
        child_id: child.id,
        status: existing?.status ?? null,
        note: existing?.note ?? undefined,
      });
    });
    setAttendanceMap(newMap);

    // Don't reset success if we just submitted (refetch after save)
    if (justSubmittedRef.current) {
      justSubmittedRef.current = false;
    } else {
      setSubmitSuccess(false);
    }
  }, [children, existingRecords]);

  // Mark a single child's attendance
  const markChild = React.useCallback((childId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = new Map(prev);
      const current = next.get(childId);
      if (current) {
        next.set(childId, { ...current, status });
      }
      return next;
    });
    setSubmitSuccess(false);
  }, []);

  // Mark all children as present
  const markAllPresent = React.useCallback(() => {
    setAttendanceMap((prev) => {
      const next = new Map(prev);
      next.forEach((value, key) => {
        next.set(key, { ...value, status: 'present' });
      });
      return next;
    });
    setSubmitSuccess(false);
  }, []);

  // Submit attendance
  const handleSubmit = React.useCallback(async () => {
    if (!classroom) return;

    const records = Array.from(attendanceMap.values())
      .filter((r) => r.status !== null)
      .map((r) => ({
        child_id: r.child_id,
        status: r.status as AttendanceStatus,
        note: r.note,
      }));

    if (records.length === 0) return;

    await bulkMark.mutateAsync({
      classroom_id: classroom.id,
      date: selectedDate,
      records,
    });
    justSubmittedRef.current = true;
    setSubmitSuccess(true);
  }, [classroom, attendanceMap, selectedDate, bulkMark]);

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

  const isLoading = classroomLoading || childrenLoading || recordsLoading;
  const allMarked = stats.marked === stats.total && stats.total > 0;

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
            {t('teacherAttendance.noClassroom')}
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-subsection font-semibold text-text-heading">
                {t('teacherAttendance.title')}
              </h1>
              <p className="text-caption text-text-secondary">
                {classroom.name} — {classroom.level}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-secondary" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-subtle border border-border rounded-md px-2 py-1 text-caption text-foreground focus:outline-none focus:border-primary transition-all duration-150"
                aria-label={t('teacherAttendance.selectDate')}
              />
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-3 text-caption">
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
      <div className="flex-1 px-4 pb-32 max-w-2xl mx-auto w-full">
        <div className="space-y-3">
          {children && children.length > 0 ? (
            children.map((child) => {
              const state = attendanceMap.get(child.id);
              const currentStatus = state?.status ?? null;

              return (
                <div
                  key={child.id}
                  className={cn(
                    'bg-card border rounded-lg p-4 transition-all duration-150',
                    currentStatus === 'present' && 'border-[var(--color-present)] border-opacity-50',
                    currentStatus === 'late' && 'border-[var(--color-late)] border-opacity-50',
                    currentStatus === 'absent' && 'border-[var(--color-absent)] border-opacity-50',
                    !currentStatus && 'border-border'
                  )}
                >
                  {/* Child info */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar
                      src={child.photo_url}
                      name={`${child.first_name} ${child.last_name}`}
                      size="md"
                    />
                    <span className="text-body font-medium text-text-heading">
                      {child.first_name} {child.last_name}
                    </span>
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
      <div className="fixed bottom-0 inset-x-0 bg-card border-t border-border p-4 z-10">
        <div className="max-w-2xl mx-auto">
          {submitSuccess ? (
            <div className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 bg-[var(--color-success-muted)] text-[var(--color-success)] font-medium text-body rounded-lg">
              <Check className="w-5 h-5" />
              {t('teacherAttendance.submitSuccess')}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={stats.marked === 0 || bulkMark.isPending}
              className={cn(
                'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 font-medium text-body rounded-lg transition-all duration-150 active:scale-[0.98]',
                allMarked
                  ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                  : 'bg-primary text-primary-foreground hover:bg-primary-hover',
                (stats.marked === 0 || bulkMark.isPending) &&
                  'opacity-50 cursor-not-allowed active:scale-100'
              )}
              aria-label={t('teacherAttendance.submit')}
            >
              <Send className="w-5 h-5" />
              {bulkMark.isPending
                ? t('teacherAttendance.submitting')
                : t('teacherAttendance.submit')}
              {stats.marked > 0 && !bulkMark.isPending && (
                <span className="text-caption opacity-80">
                  ({stats.marked}/{stats.total})
                </span>
              )}
            </button>
          )}

          {bulkMark.isError && (
            <p className="text-caption text-[var(--color-danger)] text-center mt-2">
              {t('teacherAttendance.submitError')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
