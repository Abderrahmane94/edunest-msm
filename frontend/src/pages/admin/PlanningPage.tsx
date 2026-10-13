import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarOff, ChevronLeft, ChevronRight, Clock, Pencil, Printer } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorAlert,
  Input,
  ListSkeleton,
  PageHeader,
  StatusBadge,
  Tabs,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { ClassTag } from '@/components/ClassTag';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate } from '@/lib/formatters';
import { printDocument } from '@/lib/printDocument';
import { usePermissions } from '@/lib/roles';
import { useTabParam } from '@/hooks/useTabParam';
import {
  ABSENCE_REASONS,
  addDays,
  addMonths,
  dayLabel,
  daysCount,
  hoursLabel,
  monthBounds,
  monthLabel,
  useAbsences,
  useDeleteAbsence,
  usePlanningSummary,
  usePlanningWeek,
  useSaveAbsence,
  useSetShifts,
  weekLabel,
  weekdayName,
  weekdayOf,
  type Absence,
  type AbsenceReason,
  type PlanningDay,
  type PlanningPerson,
  type PlanningWeek,
  type Shift,
  type ShiftWeek,
} from '@/hooks/usePlanning';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-2 text-body text-foreground';
const REASON_BADGE: Record<string, 'warning' | 'info' | 'neutral' | 'overdue'> = { illness: 'warning', leave: 'info', unpaid: 'overdue', training: 'info', other: 'neutral' };
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Previous / next around a title (a week, a month). */
function Stepper({ label, onPrevious, onNext, onToday, previousLabel, nextLabel, todayLabel }: { label: string; onPrevious: () => void; onNext: () => void; onToday?: () => void; previousLabel: string; nextLabel: string; todayLabel?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" aria-label={previousLabel} title={previousLabel} onClick={onPrevious}>
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
      </Button>
      <span className="min-w-[150px] text-center text-body font-semibold text-text-heading tabular-nums">{label}</span>
      <Button type="button" variant="ghost" size="icon" aria-label={nextLabel} title={nextLabel} onClick={onNext}>
        <ChevronRight className="w-4 h-4 rtl:rotate-180" />
      </Button>
      {onToday && (
        <Button type="button" variant="secondary" size="sm" onClick={onToday}>
          {todayLabel}
        </Button>
      )}
    </div>
  );
}

/** What a person does on a day: their hours, or why they are away, and whom they replace. */
function DayCell({ day, compact }: { day: PlanningDay; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn('space-y-1', compact && 'text-end')}>
      {day.shifts.length === 0 && !day.absence && day.replacing.length === 0 && <span className="text-caption text-text-disabled">—</span>}
      {day.shifts.map((s) => (
        <p key={s.start} dir="ltr" className={cn('text-caption font-medium tabular-nums whitespace-nowrap', compact && 'text-end', day.absence ? 'line-through text-text-disabled' : 'text-foreground')}>
          {s.start} – {s.end}
        </p>
      ))}
      {day.absence && (
        <StatusBadge variant={REASON_BADGE[day.absence.reason] ?? 'neutral'} title={day.absence.note ?? undefined}>
          {t(`planning.reasons.${day.absence.reason}`, { defaultValue: t('planning.reasons.other') })}
        </StatusBadge>
      )}
      {day.replacing.map((r) => (
        <p key={r.classroomId} className="text-micro text-primary font-medium [overflow-wrap:anywhere]">
          {t('planning.replaces', { classroom: r.classroom })}
        </p>
      ))}
    </div>
  );
}

/** The days worth a column: those somebody works, is away or replaces on; Sunday to Thursday when nothing is planned yet. */
function shownDays(week: PlanningWeek): number[] {
  const used = week.days.map((_, i) => i).filter((i) => week.people.some((p) => p.days[i].shifts.length > 0 || p.days[i].absence || p.days[i].replacing.length > 0));
  const usual = week.days.map((_, i) => i).filter((i) => weekdayOf(week.days[i]) <= 4);
  return [...new Set([...usual, ...used])].sort((a, b) => a - b);
}

function PersonLabel({ person }: { person: PlanningPerson }) {
  const { t } = useTranslation();
  return (
    <>
      <span className="block text-body font-medium text-foreground [overflow-wrap:anywhere]">
        {person.firstName} {person.lastName}
      </span>
      <span className="block text-caption text-text-secondary [overflow-wrap:anywhere]">{person.position ?? t(`users.roles.${person.role}`, { defaultValue: person.role })}</span>
      {person.classrooms.length > 0 && (
        <span className="flex flex-wrap gap-1 mt-1">
          {person.classrooms.map((c) => <ClassTag key={c.id} id={c.id} name={c.name} />)}
        </span>
      )}
    </>
  );
}

/** One person's usual week: a time in and a time out for each day worked, the same every week or alternating. */
function ShiftsDialog({ person, weekType, onClose }: { person: PlanningPerson | null; weekType: 'a' | 'b'; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const save = useSetShifts();
  type Row = { on: boolean; start: string; end: string };
  const blank = (): Record<ShiftWeek, Row[]> => ({
    all: WEEKDAYS.map(() => ({ on: false, start: '08:00', end: '16:00' })),
    a: WEEKDAYS.map(() => ({ on: false, start: '07:30', end: '12:30' })),
    b: WEEKDAYS.map(() => ({ on: false, start: '12:30', end: '17:30' })),
  });
  const [alternates, setAlternates] = React.useState(false);
  const [rows, setRows] = React.useState(blank);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!person) return;
    setError(null);
    const next = blank();
    for (const s of person.template) next[s.week][s.weekday] = { on: true, start: s.start, end: s.end };
    setRows(next);
    setAlternates(person.template.some((s) => s.week !== 'all'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person]);

  const setRow = (week: ShiftWeek, weekday: number, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [week]: r[week].map((row, i) => (i === weekday ? { ...row, ...patch } : row)) }));

  /** The first day worked gives its hours to the others (Sunday to Thursday). */
  function fillWeek(week: ShiftWeek) {
    setRows((r) => {
      const model = r[week].find((row) => row.on) ?? r[week][0];
      return { ...r, [week]: r[week].map((row, i) => (i <= 4 ? { on: true, start: model.start, end: model.end } : row)) };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setError(null);
    const weeks: ShiftWeek[] = alternates ? ['a', 'b'] : ['all'];
    const shifts: Shift[] = weeks.flatMap((week) => rows[week].flatMap((row, weekday) => (row.on ? [{ weekday, week, start: row.start, end: row.end }] : [])));
    if (shifts.some((s) => !s.start || !s.end || s.end <= s.start)) {
      setError(t('errors.server.shiftEndsBeforeStart'));
      return;
    }
    try {
      await save.mutateAsync({ userId: person.id, shifts });
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  const block = (week: ShiftWeek) => (
    <fieldset key={week} className="rounded-lg border border-border p-3 space-y-2">
      <legend className="px-1 text-label font-semibold text-text-heading flex items-center gap-2">
        {week === 'all' ? t('planning.shifts.everyWeek') : t(`planning.week.${week}`)}
        {week === weekType && alternates && <StatusBadge variant="info">{t('planning.shifts.thisWeek')}</StatusBadge>}
      </legend>
      {WEEKDAYS.map((weekday) => {
        const row = rows[week][weekday];
        const id = `sh-${week}-${weekday}`;
        return (
          <div key={weekday} className="flex items-center gap-2">
            <label htmlFor={id} className="flex items-center gap-2 w-32 shrink-0 text-body text-foreground capitalize cursor-pointer">
              <input id={id} type="checkbox" className="w-4 h-4 accent-[var(--color-primary)]" checked={row.on} onChange={(e) => setRow(week, weekday, { on: e.target.checked })} />
              {weekdayName(weekday, i18n.language)}
            </label>
            {row.on ? (
              <span className="flex items-center gap-1.5" dir="ltr">
                <Input type="time" aria-label={t('planning.shifts.start')} value={row.start} onChange={(e) => setRow(week, weekday, { start: e.target.value })} className="w-[7.5rem]" />
                <span className="text-text-secondary">–</span>
                <Input type="time" aria-label={t('planning.shifts.end')} value={row.end} onChange={(e) => setRow(week, weekday, { end: e.target.value })} className="w-[7.5rem]" />
              </span>
            ) : (
              <span className="text-caption text-text-disabled">{t('planning.shifts.off')}</span>
            )}
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={() => fillWeek(week)}>
        {t('planning.shifts.fill')}
      </Button>
    </fieldset>
  );

  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('planning.shifts.title', { name: person ? `${person.firstName} ${person.lastName}` : '' })}</DialogTitle>
          <DialogDescription>{t('planning.shifts.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
            <input id="sh-alternates" type="checkbox" className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]" checked={alternates} onChange={(e) => setAlternates(e.target.checked)} />
            <span>
              <span className="block text-body font-medium text-foreground">{t('planning.shifts.alternates')}</span>
              <span className="block text-caption text-text-secondary">{t('planning.shifts.alternatesHint')}</span>
            </span>
          </label>
          {alternates ? (['a', 'b'] as const).map(block) : block('all')}
          <ErrorAlert message={error} />
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AbsenceDraft = { id?: string; userId: string; startDate: string; endDate: string; reason: AbsenceReason; note: string };

/** Records that somebody is away, for a day or a period, or changes what was recorded. */
function AbsenceDialog({ draft, people, onClose }: { draft: AbsenceDraft | null; people: { id: string; firstName: string; lastName: string }[]; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSaveAbsence();
  const remove = useDeleteAbsence();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [form, setForm] = React.useState<AbsenceDraft | null>(draft);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(draft);
    setError(null);
  }, [draft]);

  if (!form) return null;
  const set = (patch: Partial<AbsenceDraft>) => setForm((f) => (f ? { ...f, ...patch } : f));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    if (!form.userId) {
      setError(t('planning.absence.personRequired'));
      return;
    }
    if (form.endDate < form.startDate) {
      setError(t('errors.server.endBeforeStart'));
      return;
    }
    try {
      await save.mutateAsync({ ...form, note: form.note.trim() || null });
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function handleDelete() {
    if (!form?.id) return;
    const ok = await confirm({ title: t('planning.absence.deleteTitle'), description: t('planning.absence.deleteDescription'), confirmLabel: t('common.delete'), tone: 'danger' });
    if (!ok) return;
    try {
      await remove.mutateAsync(form.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        {confirmDialog}
        <DialogHeader>
          <DialogTitle>{form.id ? t('planning.absence.editTitle') : t('planning.absence.createTitle')}</DialogTitle>
          <DialogDescription>{t('planning.absence.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('planning.absence.person')} htmlFor="ab-person" required>
            <select id="ab-person" value={form.userId} disabled={!!form.id} onChange={(e) => set({ userId: e.target.value })} className={selectClass}>
              <option value="">{t('planning.absence.choosePerson')}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-x-3">
            <FormField label={t('planning.absence.from')} htmlFor="ab-from" required>
              <Input id="ab-from" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })} />
            </FormField>
            <FormField label={t('planning.absence.to')} htmlFor="ab-to" required>
              <Input id="ab-to" type="date" value={form.endDate} min={form.startDate} onChange={(e) => set({ endDate: e.target.value })} />
            </FormField>
          </div>
          <FormField label={t('planning.absence.reason')} htmlFor="ab-reason" required>
            <select id="ab-reason" value={form.reason} onChange={(e) => set({ reason: e.target.value as AbsenceReason })} className={selectClass}>
              {ABSENCE_REASONS.map((r) => <option key={r} value={r}>{t(`planning.reasons.${r}`)}</option>)}
            </select>
          </FormField>
          <FormField label={t('planning.absence.note')} htmlFor="ab-note">
            <Input id="ab-note" value={form.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} />
          </FormField>
          <ErrorAlert message={error} />
          <DialogFooter className="flex-wrap gap-2">
            {form.id && (
              <Button type="button" variant="ghost" size="sm" className="text-danger me-auto" disabled={remove.isPending} onClick={handleDelete}>
                {t('common.delete')}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One person's week, day under day: what a teacher or an office member reads on a phone. */
export function MyWeek({ week }: { week: PlanningWeek }) {
  const { t, i18n } = useTranslation();
  const person = week.people[0];
  if (!person) return <EmptyState message={t('planning.empty')} />;
  const noWeek = person.template.length === 0;
  return (
    <div className="space-y-3">
      {noWeek && <p className="rounded-xl bg-subtle px-4 py-3 text-body text-text-secondary">{t('planning.mine.noWeek')}</p>}
      <ul className="bg-card border border-border rounded-xl divide-y divide-border">
        {person.days
          .filter((d) => weekdayOf(d.date) <= 4 || d.shifts.length > 0 || d.absence || d.replacing.length > 0)
          .map((d) => (
            <li key={d.date} className={cn('px-4 py-3 flex items-start justify-between gap-3', d.date === week.today && 'bg-[var(--color-accent-muted)]')}>
              <span className="text-body font-medium text-foreground capitalize">
                {dayLabel(d.date, i18n.language, 'long')}
                {d.date === week.today && <span className="ms-2 text-micro font-semibold text-primary normal-case">{t('planning.today')}</span>}
              </span>
              <DayCell day={d} compact />
            </li>
          ))}
      </ul>
    </div>
  );
}

/** The week of the whole team: one line a person, one column a day. */
function WeekTab({ week, canEdit, onShifts, onAbsence }: { week: PlanningWeek; canEdit: boolean; onShifts: (p: PlanningPerson) => void; onAbsence: (draft: AbsenceDraft) => void }) {
  const { t, i18n } = useTranslation();
  const columns = shownDays(week);
  const nobodyPlanned = week.people.every((p) => p.template.length === 0);

  return (
    <div className="space-y-3">
      {week.alerts.length > 0 && (
        <ul className="rounded-xl bg-warning-muted px-4 py-3 space-y-1.5">
          {week.alerts.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-body text-foreground">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
              <span>
                <span className="font-medium capitalize">{dayLabel(a.date, i18n.language, 'long')}</span>
                {' — '}
                {a.kind === 'class'
                  ? t('planning.alerts.class', { classroom: a.classroom, teacher: a.teacher })
                  : a.actual
                    ? t(`planning.alerts.${a.kind}Late`, { usual: a.usual, actual: a.actual })
                    : t(`planning.alerts.${a.kind}Nobody`, { usual: a.usual })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {nobodyPlanned && canEdit && <p className="rounded-xl bg-subtle px-4 py-3 text-body text-text-secondary">{t('planning.noWeekYet')}</p>}

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-subtle">
              <th scope="col" className="sticky start-0 z-[1] bg-subtle text-start px-4 py-2.5 text-caption font-semibold text-text-secondary w-[210px]">
                {t('planning.person')}
              </th>
              {columns.map((i) => (
                <th key={week.days[i]} scope="col" className={cn('text-start px-3 py-2.5 text-caption font-semibold capitalize', week.days[i] === week.today ? 'text-primary' : 'text-text-secondary')}>
                  {dayLabel(week.days[i], i18n.language)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.people.map((p) => (
              <tr key={p.id} className="border-t border-border align-top">
                <th scope="row" className="sticky start-0 z-[1] bg-card text-start px-4 py-3 font-normal">
                  <span className="flex items-start gap-1">
                    <span className="flex-1 min-w-0">
                      <PersonLabel person={p} />
                    </span>
                    {canEdit && (
                      <Button variant="ghost" size="sm" aria-label={t('planning.shifts.edit', { name: `${p.firstName} ${p.lastName}` })} title={t('planning.shifts.edit', { name: `${p.firstName} ${p.lastName}` })} onClick={() => onShifts(p)}>
                        <Pencil className="w-4 h-4 text-primary" />
                      </Button>
                    )}
                  </span>
                </th>
                {columns.map((i) => {
                  const d = p.days[i];
                  const mine = d.absence && !d.absence.id.startsWith('substitution:') ? d.absence : null;
                  const open = () =>
                    onAbsence(
                      mine
                        ? { id: mine.id, userId: p.id, startDate: mine.startDate, endDate: mine.endDate, reason: mine.reason as AbsenceReason, note: mine.note ?? '' }
                        : { userId: p.id, startDate: d.date, endDate: d.date, reason: 'illness', note: '' },
                    );
                  return (
                    <td key={d.date} className={cn('px-3 py-3', d.date === week.today && 'bg-[var(--color-accent-muted)]')}>
                      {canEdit && (!d.absence || mine) ? (
                        <button type="button" onClick={open} title={mine ? t('planning.absence.editTitle') : t('planning.absence.createTitle')} className="w-full text-start rounded-md -m-1 p-1 hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus-ring">
                          <DayCell day={d} />
                        </button>
                      ) : (
                        <DayCell day={d} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && <p className="text-caption text-text-secondary">{t('planning.hint')}</p>}
    </div>
  );
}

/** The absences recorded over a month. */
function AbsencesTab({ canEdit, onEdit }: { canEdit: boolean; onEdit: (draft: AbsenceDraft) => void }) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [from, to] = monthBounds(month);
  const { data, isLoading, isError, error } = useAbsences(from, to);
  return (
    <div className="space-y-3">
      <Stepper label={monthLabel(month, i18n.language)} onPrevious={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} previousLabel={t('planning.previousMonth')} nextLabel={t('planning.nextMonth')} />
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<CalendarOff />} message={t('planning.absence.empty')} />
      ) : (
        <ul className="bg-card border border-border rounded-lg divide-y divide-border">
          {(data as Absence[]).map((a) => (
            <li key={a.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <p className="text-body font-medium text-foreground">{a.user?.firstName} {a.user?.lastName}</p>
                <p className="text-caption text-text-secondary">
                  <span dir="ltr">{formatDate(a.startDate)}</span>
                  {a.endDate !== a.startDate && <> → <span dir="ltr">{formatDate(a.endDate)}</span></>}
                  {' · '}
                  {t('planning.absence.days', { count: daysCount(a.startDate, a.endDate) })}
                  {a.note && ` · ${a.note}`}
                </p>
              </div>
              <StatusBadge variant={REASON_BADGE[a.reason] ?? 'neutral'}>{t(`planning.reasons.${a.reason}`)}</StatusBadge>
              {canEdit && (
                <Button variant="ghost" size="sm" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => onEdit({ id: a.id, userId: a.userId, startDate: a.startDate, endDate: a.endDate, reason: a.reason, note: a.note ?? '' })}>
                  <Pencil className="w-4 h-4 text-primary" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-text-secondary">{t('planning.absence.substitutionsNote')}</p>
    </div>
  );
}

/** A month in hours, person by person: what the pay is worked out from. */
function HoursTab() {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const { data, isLoading, isError, error } = usePlanningSummary(month);
  const h = (minutes: number) => hoursLabel(minutes, i18n.language);
  return (
    <div className="space-y-3">
      <Stepper label={monthLabel(month, i18n.language)} onPrevious={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} previousLabel={t('planning.previousMonth')} nextLabel={t('planning.nextMonth')} />
      {data?.until && <p className="text-caption text-text-secondary">{t('planning.hours.until', { date: formatDate(data.until) })}</p>}
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse tabular-nums">
            <thead>
              <tr className="bg-subtle text-caption font-semibold text-text-secondary">
                <th scope="col" className="text-start px-4 py-2.5">{t('planning.person')}</th>
                <th scope="col" className="text-end px-3 py-2.5">{t('planning.hours.planned')}</th>
                <th scope="col" className="text-end px-3 py-2.5">{t('planning.hours.absentDays')}</th>
                <th scope="col" className="text-end px-3 py-2.5">{t('planning.hours.absent')}</th>
                <th scope="col" className="text-end px-4 py-2.5">{t('planning.hours.worked')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.people ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <th scope="row" className="text-start px-4 py-2.5 font-normal">
                    <span className="block text-body font-medium text-foreground">{p.firstName} {p.lastName}</span>
                    <span className="block text-caption text-text-secondary">{p.position ?? t(`users.roles.${p.role}`, { defaultValue: p.role })}</span>
                  </th>
                  <td className="text-end px-3 py-2.5 text-body text-foreground">{p.hasWeek ? h(p.plannedMinutes) : <span className="text-caption text-text-disabled">{t('planning.hours.noWeek')}</span>}</td>
                  <td className="text-end px-3 py-2.5 text-body text-foreground">
                    {p.absentDaysTotal > 0 ? (
                      <span title={Object.entries(p.absentDays).map(([reason, n]) => `${t(`planning.reasons.${reason}`, { defaultValue: reason })} : ${n}`).join(' · ')}>
                        {t('planning.absence.days', { count: p.absentDaysTotal })}
                        <span className="block text-micro text-text-secondary">
                          {Object.entries(p.absentDays).map(([reason, n]) => `${t(`planning.reasons.${reason}`, { defaultValue: reason })} ${n}`).join(' · ')}
                        </span>
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-end px-3 py-2.5 text-body text-foreground">{p.hasWeek && p.absentMinutes > 0 ? h(p.absentMinutes) : '—'}</td>
                  <td className="text-end px-4 py-2.5 text-body font-semibold text-foreground">{p.hasWeek ? h(p.workedMinutes) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-caption text-text-secondary">{t('planning.hours.note')}</p>
    </div>
  );
}

type Tab = 'week' | 'absences' | 'hours';

/** The team's planning: who works when, who is away, and the hours of the month. */
export function PlanningPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useTabParam<Tab>(['week', 'absences', 'hours'], 'week');
  const [start, setStart] = React.useState<string | undefined>(undefined);
  const { data: week, isLoading, isError, error } = usePlanningWeek(start);
  const canEdit = usePermissions().can('staff', 'edit');
  const [shiftsOf, setShiftsOf] = React.useState<PlanningPerson | null>(null);
  const [absence, setAbsence] = React.useState<AbsenceDraft | null>(null);
  const printRef = React.useRef<HTMLDivElement>(null);

  const whole = week?.whole ?? false;
  const manage = whole && canEdit;
  const people = (week?.people ?? []).map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName }));

  function print() {
    if (!printRef.current || !week) return;
    printDocument(printRef.current, { fileName: `${t('planning.title')} ${week.start}`, language: i18n.language, direction: i18n.dir() });
  }

  const weekNav = week && (
    <div className="flex flex-wrap items-center gap-2">
      <Stepper
        label={weekLabel(week.start, i18n.language)}
        onPrevious={() => setStart(addDays(week.start, -7))}
        onNext={() => setStart(addDays(week.start, 7))}
        onToday={() => setStart(undefined)}
        previousLabel={t('planning.previousWeek')}
        nextLabel={t('planning.nextWeek')}
        todayLabel={t('planning.thisWeek')}
      />
      {week.alternates && <StatusBadge variant="info">{t(`planning.week.${week.weekType}`)}</StatusBadge>}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={whole || !week ? t('planning.title') : t('planning.mine.title')}
        description={whole || !week ? t('pageIntro.planning') : t('planning.mine.subtitle')}
        actions={
          manage && (
            <div className="flex flex-wrap gap-2">
              {tab === 'week' && (
                <Button variant="secondary" onClick={print}>
                  <Printer className="w-4 h-4" />
                  {t('planning.print')}
                </Button>
              )}
              <Button onClick={() => setAbsence({ userId: '', startDate: week?.today ?? '', endDate: week?.today ?? '', reason: 'illness', note: '' })}>
                <CalendarOff className="w-4 h-4" />
                {t('planning.absence.create')}
              </Button>
            </div>
          )
        }
      />

      {whole && (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'week', label: t('planning.tabs.week') },
            { value: 'absences', label: t('planning.tabs.absences'), icon: <CalendarOff /> },
            { value: 'hours', label: t('planning.tabs.hours'), icon: <Clock /> },
          ]}
        />
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : !week ? null : !whole ? (
        <>
          {weekNav}
          <MyWeek week={week} />
        </>
      ) : tab === 'absences' ? (
        <AbsencesTab canEdit={canEdit} onEdit={setAbsence} />
      ) : tab === 'hours' ? (
        <HoursTab />
      ) : week.people.length === 0 ? (
        <EmptyState message={t('planning.empty')} />
      ) : (
        <>
          {weekNav}
          <div ref={printRef}>
            <h2 className="hidden print:block text-subsection font-semibold mb-2">
              {t('planning.title')} — {weekLabel(week.start, i18n.language)}
              {week.alternates && ` (${t(`planning.week.${week.weekType}`)})`}
            </h2>
            <WeekTab week={week} canEdit={canEdit} onShifts={setShiftsOf} onAbsence={setAbsence} />
          </div>
        </>
      )}

      <ShiftsDialog person={shiftsOf} weekType={week?.weekType ?? 'a'} onClose={() => setShiftsOf(null)} />
      <AbsenceDialog draft={absence} people={people} onClose={() => setAbsence(null)} />
    </div>
  );
}
