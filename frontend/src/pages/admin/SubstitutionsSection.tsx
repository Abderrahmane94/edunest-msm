import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, UserRoundCog } from 'lucide-react';
import { Button, ErrorAlert, StatusBadge, useConfirm } from '@/components/ui';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate } from '@/lib/formatters';
import {
  personName,
  substitutionStatus,
  useCancelSubstitution,
  useEndSubstitution,
  useSubstitutions,
  type Substitution,
} from '@/hooks/useSubstitutions';
import { SubstitutionDialog } from './SubstitutionDialog';

const STATUS_BADGE = { current: 'success', upcoming: 'sent', past: 'draft', cancelled: 'cancelled' } as const;

function dates(s: Substitution): string {
  const a = s.startDate.slice(0, 10);
  const b = s.endDate.slice(0, 10);
  return a === b ? formatDate(a) : `${formatDate(a)} → ${formatDate(b)}`;
}

/**
 * Replacements, current and upcoming first: who replaces whom, when, why;
 * with "back today" and cancel. `perspective` says whose side is shown: a
 * class (who replaced its teacher) or a teacher (away, or replacing).
 */
function SubstitutionRows({
  list,
  perspective,
  readOnly,
  onEdit,
}: {
  list: Substitution[];
  perspective: { classroom: true } | { userId: string };
  readOnly: boolean;
  onEdit?: (s: Substitution) => void;
}) {
  const { t } = useTranslation();
  const end = useEndSubstitution();
  const cancel = useCancelSubstitution();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [error, setError] = React.useState<string | null>(null);
  const order = { current: 0, upcoming: 1, past: 2, cancelled: 3 };
  const sorted = [...list].sort((a, b) => order[substitutionStatus(a)] - order[substitutionStatus(b)]);

  async function run(action: 'end' | 'cancel', s: Substitution) {
    const ok = await confirm({
      title: t(`substitutions.list.${action}ConfirmTitle`),
      description: t(`substitutions.list.${action}ConfirmDescription`),
      confirmLabel: t(`substitutions.list.${action}`),
    });
    if (!ok) return;
    setError(null);
    try {
      await (action === 'end' ? end : cancel).mutateAsync(s.id);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <>
      {confirmDialog}
      <ErrorAlert message={error} />
      <ul className="divide-y divide-border">
        {sorted.map((s) => {
          const status = substitutionStatus(s);
          const who =
            'classroom' in perspective
              ? s.substitute
                ? t('substitutions.list.replacedBy', { name: personName(s.substitute) })
                : t('substitutions.list.nobody')
              : s.substituteUserId === perspective.userId
                ? t('substitutions.list.replaces', { name: personName(s.absentTeacher) || '—', classroom: s.classroom.name })
                : s.substitute
                  ? t('substitutions.list.awayReplacedBy', { classroom: s.classroom.name, name: personName(s.substitute) })
                  : t('substitutions.list.awayNobody', { classroom: s.classroom.name });
          return (
            <li key={s.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge variant={STATUS_BADGE[status]}>{t(`substitutions.status.${status}`)}</StatusBadge>
              <div className="flex-1 min-w-[12rem]">
                <p className={`text-body ${s.substitute ? 'text-foreground' : 'text-warning'}`}>{who}</p>
                <p className="text-caption text-text-secondary">
                  <span dir="ltr">{dates(s)}</span> · {t(`substitutions.reasons.${s.reason}`)}
                  {s.note && ` · ${s.note}`}
                  {s.parentsNotified && ` · ${t('substitutions.list.parentsNotified')}`}
                </p>
              </div>
              {!readOnly && status === 'current' && (
                <Button type="button" variant="secondary" size="sm" disabled={end.isPending} onClick={() => run('end', s)}>
                  {t('substitutions.list.end')}
                </Button>
              )}
              {!readOnly && status === 'upcoming' && (
                <Button type="button" variant="ghost" size="sm" className="text-danger" disabled={cancel.isPending} onClick={() => run('cancel', s)}>
                  {t('substitutions.list.cancel')}
                </Button>
              )}
              {!readOnly && onEdit && (status === 'current' || status === 'upcoming') && (
                <Button type="button" variant="ghost" size="sm" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => onEdit(s)}>
                  <Pencil className="w-4 h-4 text-primary" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A class's replacements, with "Remplacer" for today or a period. */
export function ClassSubstitutionsSection({
  classroom,
  readOnly,
}: {
  classroom: { id: string; name: string; teacherId: string | null; academicYearId: string };
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { data: list = [], isLoading } = useSubstitutions({ classroomId: classroom.id });
  const [dialog, setDialog] = React.useState<{ mode: 'today' | 'period'; editing: Substitution | null } | null>(null);
  const current = list.find((s) => substitutionStatus(s) === 'current');

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subsection font-semibold text-text-heading flex items-center gap-2">
          <UserRoundCog className="w-5 h-5 text-text-secondary" />
          {t('substitutions.section.title')}
        </h2>
        {!readOnly && (
          <div className="flex gap-2">
            {!current && (
              <Button type="button" size="sm" onClick={() => setDialog({ mode: 'today', editing: null })}>
                {t('substitutions.section.today')}
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={() => setDialog({ mode: 'period', editing: null })}>
              {t('substitutions.section.plan')}
            </Button>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="animate-pulse h-12 bg-subtle rounded-md" />
      ) : list.length === 0 ? (
        <p className="text-body text-text-secondary">{t('substitutions.section.empty')}</p>
      ) : (
        <SubstitutionRows
          list={list}
          perspective={{ classroom: true }}
          readOnly={readOnly}
          onEdit={(s) => setDialog({ mode: 'period', editing: s })}
        />
      )}
      {dialog && (
        <SubstitutionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          classroom={classroom}
          editing={dialog.editing}
          initialMode={dialog.mode}
        />
      )}
    </div>
  );
}

/** A teacher's replacements: when they were away, and the classes they took. */
export function TeacherSubstitutionsSection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: list = [], isLoading } = useSubstitutions({ userId });
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-3">
      <h2 className="text-subsection font-semibold text-text-heading flex items-center gap-2">
        <UserRoundCog className="w-5 h-5 text-text-secondary" />
        {t('substitutions.section.title')}
      </h2>
      {isLoading ? (
        <div className="animate-pulse h-12 bg-subtle rounded-md" />
      ) : list.length === 0 ? (
        <p className="text-body text-text-secondary">{t('substitutions.section.emptyTeacher')}</p>
      ) : (
        <SubstitutionRows list={list} perspective={{ userId }} readOnly />
      )}
    </div>
  );
}
