import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, HeartPulse, UserPlus } from 'lucide-react';
import { Avatar, Button, StatusBadge } from '@/components/ui';
import { useChildren } from '@/hooks/useChildren';
import { useClassroomAttendance } from '@/hooks/useAttendance';
import { today } from '@/hooks/useSubstitutions';
import { usePermissions } from '@/lib/roles';
import { childAge } from './ChildQuickView';
import { CreateChildWizard } from './CreateChildWizard';

/**
 * Who is in the class: each child with their age, a health flag and today's
 * attendance once taken; a tap opens the child file.
 */
export function ClassroomChildrenSection({
  classroom,
  readOnly,
}: {
  classroom: { id: string; capacity: number; isCurrentYear: boolean };
  readOnly: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const { data, isLoading } = useChildren({ all: true, classroomId: classroom.id });
  // Today's roll call, for a class of the current year.
  const { data: todayRecords } = useClassroomAttendance(classroom.isCurrentYear ? classroom.id : undefined, today());

  const collator = React.useMemo(() => new Intl.Collator(i18n.language === 'ar' ? 'ar' : 'fr', { sensitivity: 'base' }), [i18n.language]);
  const children = [...(data?.children ?? [])].sort(
    (a, b) => collator.compare(a.first_name, b.first_name) || collator.compare(a.last_name, b.last_name),
  );
  const statusOf = new Map((todayRecords ?? []).map((r) => [r.childId, r.status]));

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-subsection font-semibold text-text-heading">
          {t('classrooms.children.title', { count: children.length, capacity: classroom.capacity })}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/children?classroom=${classroom.id}`}
            className="text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:shadow-focus-ring rounded"
          >
            {t('classrooms.children.seeAll')}
          </Link>
          {!readOnly && can('children', 'edit') && (
            <Button type="button" size="sm" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="w-4 h-4" />
              {t('classrooms.children.enroll')}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-hover rounded-md" />)}
        </div>
      ) : children.length === 0 ? (
        <p className="text-body text-text-secondary">{t('classrooms.children.empty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {children.map((child) => {
            const status = statusOf.get(child.id);
            return (
              <li key={child.id}>
                <Link
                  to={`/admin/children/${child.id}`}
                  className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-hover focus-visible:outline-none focus-visible:shadow-focus-ring"
                >
                  <Avatar src={child.photo_url} name={`${child.first_name} ${child.last_name}`} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-body font-medium text-text-heading truncate" dir="auto">
                      {child.first_name} {child.last_name}
                    </span>
                    <span className="block text-caption text-text-secondary">{childAge(child.date_of_birth, t)}</span>
                  </span>
                  {!!child.medical_note_count && (
                    <span
                      className="shrink-0 inline-flex items-center gap-1 rounded-full bg-danger-muted px-2 py-0.5 text-micro font-medium text-danger"
                      title={t('classrooms.children.health')}
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('classrooms.children.health')}</span>
                    </span>
                  )}
                  {status && <StatusBadge variant={status}>{t(`attendance.statuses.${status}`)}</StatusBadge>}
                  <ChevronRight className="w-4 h-4 shrink-0 text-text-disabled rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CreateChildWizard open={enrollOpen} onOpenChange={setEnrollOpen} initialClassroomId={classroom.id} />
    </div>
  );
}
