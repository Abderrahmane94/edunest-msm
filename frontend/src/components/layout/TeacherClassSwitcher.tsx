import { useTranslation } from 'react-i18next';
import { School, UserRoundCog } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { setTeacherClassId, useCurrentTeacherClass } from '@/hooks/useSubstitutions';

/** For a teacher with several classes today (theirs and one they replace): which one they work with. */
export function TeacherClassSwitcher() {
  const { t } = useTranslation();
  const { classes, current } = useCurrentTeacherClass();
  if (classes.length < 2 || !current) return null;

  return (
    <label className="flex items-center gap-2 h-9 ps-3 pe-1 rounded-full border border-border bg-card text-caption text-text-secondary">
      <School className="w-4 h-4 hidden sm:block" />
      <span className="sr-only">{t('substitutions.teacher.switchLabel')}</span>
      <select
        value={current.id}
        onChange={(e) => setTeacherClassId(e.target.value)}
        className="bg-transparent text-foreground font-medium focus:outline-none max-w-[15rem]"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.substitution ? t('substitutions.teacher.replacing', { name: c.name }) : c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Says, while replacing, whose class it is and until when. */
export function SubstitutionBanner() {
  const { t } = useTranslation();
  const { current } = useCurrentTeacherClass();
  if (!current?.substitution) return null;
  const s = current.substitution;
  const oneDay = s.startDate.slice(0, 10) === s.endDate.slice(0, 10);

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--color-accent-muted)] px-4 py-2.5 text-body text-foreground"
    >
      <UserRoundCog className="w-4 h-4 text-primary shrink-0" />
      <span>
        {oneDay
          ? t(s.absentTeacherName ? 'substitutions.teacher.bannerToday' : 'substitutions.teacher.bannerTodayNoTeacher', {
              name: current.name,
              teacher: s.absentTeacherName,
            })
          : t(s.absentTeacherName ? 'substitutions.teacher.bannerPeriod' : 'substitutions.teacher.bannerPeriodNoTeacher', {
              name: current.name,
              teacher: s.absentTeacherName,
              until: formatDate(s.endDate),
            })}
      </span>
    </div>
  );
}
