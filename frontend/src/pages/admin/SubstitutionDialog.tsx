import { announceNewAccount } from '@/lib/newAccount';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Input,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { ApiRequestError } from '@/lib/api-client';
import { useUsers } from '@/hooks/useUsers';
import { useClassrooms } from '@/hooks/useClassrooms';
import {
  SUBSTITUTION_REASONS,
  today,
  useCreateSubstitution,
  useSubstitutions,
  useUpdateSubstitution,
  type Substitution,
  type SubstitutionReason,
} from '@/hooks/useSubstitutions';

const NOBODY = 'nobody';
const NEW = 'new';
const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-2 text-body text-foreground';

/**
 * Records or changes a replacement: for today only or a planned period, by a
 * teacher of the school, a new substitute from outside, or nobody.
 */
export function SubstitutionDialog({
  open,
  onOpenChange,
  classroom,
  editing,
  initialMode = 'today',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The class replaced: its own teacher isn't offered as substitute. */
  classroom: { id: string; name: string; teacherId: string | null; academicYearId: string };
  /** An existing replacement to change. */
  editing?: Substitution | null;
  initialMode?: 'today' | 'period';
}) {
  const { t } = useTranslation();
  const create = useCreateSubstitution();
  const update = useUpdateSubstitution();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: usersData } = useUsers({ role: 'teacher', status: 'active', pageSize: 100 });
  const { data: classrooms } = useClassrooms(classroom.academicYearId);
  const { data: todays } = useSubstitutions({ on: today() }, open);

  const [mode, setMode] = React.useState<'today' | 'period'>(initialMode);
  const [substitute, setSubstitute] = React.useState('');
  const [newSub, setNewSub] = React.useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [start, setStart] = React.useState(today());
  const [end, setEnd] = React.useState(today());
  const [reason, setReason] = React.useState<SubstitutionReason>('illness');
  const [note, setNote] = React.useState('');
  const [notifyParents, setNotifyParents] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ newSubstitute: boolean; email: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    setNewSub({ firstName: '', lastName: '', email: '', phone: '' });
    setNotifyParents(false);
    if (editing) {
      const s = editing.startDate.slice(0, 10);
      const e = editing.endDate.slice(0, 10);
      setMode(s === e ? 'today' : 'period');
      setSubstitute(editing.substituteUserId ?? NOBODY);
      setStart(s);
      setEnd(e);
      setReason(editing.reason);
      setNote(editing.note ?? '');
    } else {
      setMode(initialMode);
      setSubstitute('');
      setStart(today());
      setEnd(today());
      setReason('illness');
      setNote('');
    }
  }, [open, editing, initialMode]);

  // Teachers who take their own class today, or already replace elsewhere: said next to their name.
  const teachers = (usersData?.users ?? []).filter((u) => u.role === 'teacher' && u.id !== classroom.teacherId);
  const ownClass = (id: string) => (classrooms ?? []).find((c) => c.teacher_id === id)?.name;
  const replacingToday = (id: string) =>
    (todays ?? []).find((s) => s.substituteUserId === id && s.id !== editing?.id)?.classroom.name;

  const startDate = mode === 'today' && !editing ? today() : start;
  const endDate = mode === 'today' ? startDate : end;
  const pending = create.isPending || update.isPending;

  async function submit(allowBusySubstitute = false) {
    setError(null);
    if (!substitute) {
      setError(t('substitutions.dialog.pickSubstitute'));
      return;
    }
    if (endDate < startDate) {
      setError(t('substitutions.dialog.endBeforeStart'));
      return;
    }
    const substituteUserId = substitute === NOBODY || substitute === NEW ? null : substitute;
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, substituteUserId, startDate, endDate, reason, note: note.trim(), allowBusySubstitute });
        onOpenChange(false);
      } else {
        const res = await create.mutateAsync({
          classroomId: classroom.id,
          substituteUserId,
          ...(substitute === NEW
            ? {
                newSubstitute: {
                  firstName: newSub.firstName.trim(),
                  lastName: newSub.lastName.trim(),
                  email: newSub.email.trim(),
                  ...(newSub.phone.trim() ? { phone: newSub.phone.trim() } : {}),
                },
              }
            : {}),
          startDate,
          endDate,
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
          notifyParents: notifyParents && substitute !== NOBODY,
          allowBusySubstitute,
        });
        if (res.newSubstitute) {
          announceNewAccount({ email: newSub.email.trim(), temporaryPassword: res.temporaryPassword ?? undefined });
          setCreated({ newSubstitute: true, email: newSub.email.trim() });
        }
        else onOpenChange(false);
      }
    } catch (err) {
      // Already replacing elsewhere on those days: ask, then go ahead.
      if (err instanceof ApiRequestError && err.code === 'SUBSTITUTE_BUSY') {
        const where = /in (.+) on these dates/.exec(err.message)?.[1] ?? '';
        const ok = await confirm({
          title: t('substitutions.dialog.busyTitle'),
          description: t('substitutions.dialog.busyDescription', { classroom: where }),
          confirmLabel: t('substitutions.dialog.busyConfirm'),
        });
        if (ok) await submit(true);
        return;
      }
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        {confirmDialog}
        <DialogHeader>
          <DialogTitle>
            {editing ? t('substitutions.dialog.editTitle', { name: classroom.name }) : t('substitutions.dialog.title', { name: classroom.name })}
          </DialogTitle>
          <DialogDescription>{t('substitutions.dialog.description')}</DialogDescription>
        </DialogHeader>

        {created ? (
          <>
            <p className="text-body text-foreground">{t('substitutions.dialog.accountCreated', { email: created.email })}</p>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-3"
          >
            <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-subtle rounded-lg">
              {(['today', 'period'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-2 py-1.5 rounded-md text-caption font-medium',
                    mode === m ? 'bg-card text-foreground shadow-sm' : 'text-text-secondary hover:text-foreground',
                  )}
                >
                  {t(`substitutions.dialog.mode.${m}`)}
                </button>
              ))}
            </div>

            {mode === 'period' ? (
              <div className="grid grid-cols-2 gap-x-3">
                <FormField label={t('substitutions.dialog.from')} htmlFor="sb-start" required>
                  <Input id="sb-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </FormField>
                <FormField label={t('substitutions.dialog.to')} htmlFor="sb-end" required>
                  <Input id="sb-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
                </FormField>
              </div>
            ) : editing ? (
              <FormField label={t('substitutions.dialog.day')} htmlFor="sb-day" required>
                <Input id="sb-day" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </FormField>
            ) : null}

            <FormField label={t('substitutions.dialog.substitute')} htmlFor="sb-substitute" required>
              <select id="sb-substitute" value={substitute} onChange={(e) => setSubstitute(e.target.value)} className={selectClass}>
                <option value="">{t('substitutions.dialog.pickPlaceholder')}</option>
                {teachers.map((u) => {
                  const own = ownClass(u.id);
                  const busy = replacingToday(u.id);
                  const hint = busy
                    ? t('substitutions.dialog.alreadyReplacing', { name: busy })
                    : own
                      ? t('substitutions.dialog.hasClass', { name: own })
                      : t('substitutions.dialog.free');
                  return (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} — {hint}
                    </option>
                  );
                })}
                {!editing && <option value={NEW}>{t('substitutions.dialog.newSubstitute')}</option>}
                <option value={NOBODY}>{t('substitutions.dialog.nobody')}</option>
              </select>
            </FormField>

            {substitute === NEW && (
              <div className="rounded-md border border-border p-3 space-y-0">
                <div className="grid grid-cols-2 gap-x-3">
                  <FormField label={t('users.detail.firstName')} htmlFor="sb-first" required>
                    <Input id="sb-first" value={newSub.firstName} onChange={(e) => setNewSub({ ...newSub, firstName: e.target.value })} />
                  </FormField>
                  <FormField label={t('users.detail.lastName')} htmlFor="sb-last" required>
                    <Input id="sb-last" value={newSub.lastName} onChange={(e) => setNewSub({ ...newSub, lastName: e.target.value })} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-x-3">
                  <FormField label={t('users.detail.email')} htmlFor="sb-email" required>
                    <Input id="sb-email" type="email" value={newSub.email} onChange={(e) => setNewSub({ ...newSub, email: e.target.value })} />
                  </FormField>
                  <FormField label={t('users.detail.phone')} htmlFor="sb-phone">
                    <Input id="sb-phone" type="tel" value={newSub.phone} onChange={(e) => setNewSub({ ...newSub, phone: e.target.value })} />
                  </FormField>
                </div>
                <p className="text-caption text-text-secondary">{t('substitutions.dialog.newSubstituteHint')}</p>
              </div>
            )}
            {substitute === NOBODY && <p className="text-caption text-warning">{t('substitutions.dialog.nobodyHint')}</p>}

            <div className="grid grid-cols-2 gap-x-3">
              <FormField label={t('substitutions.dialog.reason')} htmlFor="sb-reason" required>
                <select id="sb-reason" value={reason} onChange={(e) => setReason(e.target.value as SubstitutionReason)} className={selectClass}>
                  {SUBSTITUTION_REASONS.map((r) => <option key={r} value={r}>{t(`substitutions.reasons.${r}`)}</option>)}
                </select>
              </FormField>
              <FormField label={t('substitutions.dialog.note')} htmlFor="sb-note">
                <Input id="sb-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </FormField>
            </div>

            {!editing && substitute !== NOBODY && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-border text-primary" checked={notifyParents} onChange={(e) => setNotifyParents(e.target.checked)} />
                <span className="text-body text-foreground">{t('substitutions.dialog.notifyParents')}</span>
              </label>
            )}

            <ErrorAlert message={error} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('common.loading') : editing ? t('common.save') : t('substitutions.dialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
