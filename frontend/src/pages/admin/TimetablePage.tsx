import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import { useClassrooms } from '@/hooks/useClassrooms';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useWorkingDays, useUpdateWorkingDays, type DayOfWeek } from '@/hooks/useTimetable';

const ALL_DAYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function TimetablePage() {
  const { t } = useTranslation();
  const { data: academicYears } = useAcademicYears();
  const activeYear = (academicYears ?? []).find((y) => y.is_active);
  const { data: classrooms } = useClassrooms(activeYear?.id);

  const [selectedClassroomId, setSelectedClassroomId] = React.useState<string>('');
  const { data: workingDaysData, isLoading } = useWorkingDays(selectedClassroomId || undefined);
  const updateWorkingDays = useUpdateWorkingDays();

  const [localDays, setLocalDays] = React.useState<DayOfWeek[]>([]);
  const [saved, setSaved] = React.useState(false);

  // Auto-select first classroom
  React.useEffect(() => {
    if (!selectedClassroomId && classrooms && classrooms.length > 0) {
      setSelectedClassroomId(classrooms[0].id);
    }
  }, [classrooms, selectedClassroomId]);

  // Sync local state when data loads
  React.useEffect(() => {
    if (workingDaysData) {
      setLocalDays(workingDaysData.workingDays);
      setSaved(false);
    }
  }, [workingDaysData]);

  function toggleDay(day: DayOfWeek) {
    setLocalDays((prev) => {
      if (prev.includes(day)) {
        // Don't allow removing the last day
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedClassroomId) return;
    try {
      await updateWorkingDays.mutateAsync({
        classroomId: selectedClassroomId,
        workingDays: localDays,
      });
      setSaved(true);
    } catch {
      // handled by React Query
    }
  }

  const hasChanges = workingDaysData
    ? JSON.stringify([...localDays].sort()) !== JSON.stringify([...workingDaysData.workingDays].sort())
    : false;

  const classroomOptions = (classrooms ?? []).map((c) => ({
    value: c.id,
    label: `${c.name}${c.level ? ` (${c.level})` : ''}`,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('timetable.title')}
        </h1>
        <p className="text-caption text-text-secondary mt-1">
          {t('timetable.description')}
        </p>
      </div>

      {/* Classroom selector */}
      <div className="max-w-xs">
        <FormSelect
          label={t('timetable.selectClassroom')}
          name="classroom"
          value={selectedClassroomId}
          onChange={(e) => setSelectedClassroomId(e.target.value)}
          options={classroomOptions}
          placeholder={t('attendance.selectClassroom')}
        />
      </div>

      {/* Content */}
      {!selectedClassroomId ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-body text-text-secondary">
            {t('timetable.selectClassroomPrompt')}
          </p>
        </div>
      ) : isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-subsection font-semibold text-text-heading mb-1">
              {t('timetable.workingDays')}
            </h2>
            <p className="text-caption text-text-secondary">
              {t('timetable.workingDaysHint')}
            </p>
          </div>

          {/* Day toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {ALL_DAYS.map((day) => {
              const isActive = localDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`
                    relative flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-lg border-2 transition-all duration-150
                    ${isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
                      : 'border-border bg-card text-text-secondary hover:border-[var(--color-border-strong)] hover:bg-hover'
                    }
                  `}
                  aria-pressed={isActive}
                  aria-label={t(`timetable.days.${day}`)}
                >
                  {isActive && (
                    <Check className="absolute top-1.5 end-1.5 w-4 h-4 text-[var(--color-accent)]" />
                  )}
                  <span className="text-body font-semibold">
                    {t(`timetable.days.${day}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-caption text-text-secondary">
              {t('timetable.daysPerWeek', { count: localDays.length })}
            </p>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-caption text-success font-medium">
                  {t('common.saved')}
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateWorkingDays.isPending}
              >
                {updateWorkingDays.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
