import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, ErrorAlert, ListSkeleton, PageHeader, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/errorMessage';
import { addDays, usePlanningWeek, weekLabel } from '@/hooks/usePlanning';
import { MyWeek } from '@/pages/admin/PlanningPage';

/** The teacher's own week: their hours, the days away, the classes taken for a colleague. */
export function TeacherPlanningPage() {
  const { t, i18n } = useTranslation();
  const [start, setStart] = React.useState<string | undefined>(undefined);
  const { data: week, isLoading, isError, error } = usePlanningWeek(start);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title={t('planning.mine.title')} description={t('planning.mine.subtitle')} />
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : week ? (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label={t('planning.previousWeek')} onClick={() => setStart(addDays(week.start, -7))}>
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </Button>
            <span className="min-w-[150px] text-center text-body font-semibold text-text-heading tabular-nums">{weekLabel(week.start, i18n.language)}</span>
            <Button type="button" variant="ghost" size="icon" aria-label={t('planning.nextWeek')} onClick={() => setStart(addDays(week.start, 7))}>
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStart(undefined)}>
              {t('planning.thisWeek')}
            </Button>
            {week.alternates && <StatusBadge variant="info">{t(`planning.week.${week.weekType}`)}</StatusBadge>}
          </div>
          <MyWeek week={week} />
        </>
      ) : null}
    </div>
  );
}
