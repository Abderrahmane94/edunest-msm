import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, ErrorAlert, Input, PageHeader, useConfirm } from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate, formatDZD } from '@/lib/formatters';
import { setSelectedYearId } from '@/hooks/useSelectedYear';
import {
  useRolloverPreview,
  useRunRollover,
  type ClassTarget,
  type RolloverChild,
  type RolloverPreview,
  type RolloverResult,
} from '@/hooks/useYearRollover';
import { yearLabel } from '@/lib/yearName';

const STEPS = ['classes', 'fees', 'children', 'summary'] as const;
type Step = (typeof STEPS)[number];

/** A class target as a select value: 'copy:<source class>', 'class:<class of the new year>' or 'none'. */
type TargetValue = string;
const NONE = 'none';
const toTarget = (v: TargetValue): ClassTarget =>
  v.startsWith('copy:') ? { copyOf: v.slice(5) } : v.startsWith('class:') ? { classroomId: v.slice(6) } : null;

/** Children grouped by their class of the source year ('none': without class). */
const groupOf = (c: RolloverChild) => c.sourceClassroomId ?? NONE;

/** Keeps a year name ("2026-2027") in order inside Arabic text. */
const iso = (s: string) => `⁦${s}⁩`;

const checkboxClass = 'w-4 h-4 rounded border-border text-primary focus:ring-primary';

interface State {
  classes: Record<string, { on: boolean; name: string }>;
  copyCalendar: boolean;
  percent: string;
  amounts: Record<string, string>;
  groupTarget: Record<string, TargetValue>;
  childOn: Record<string, boolean>;
  childTarget: Record<string, TargetValue>;
  billing: boolean;
  startDate: string;
  extraFees: Record<TargetValue, string[]>;
}

function initialState(p: RolloverPreview): State {
  const sameName = (name: string) =>
    p.targetClasses.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const classes: State['classes'] = {};
  const groupTarget: State['groupTarget'] = { [NONE]: NONE };
  // A year that already has classes was prepared before: nothing is copied
  // again unless ticked, and children go to the class of the same name.
  const prepared = p.targetClasses.length > 0;
  for (const c of p.classes) {
    const existing = sameName(c.name);
    classes[c.id] = { on: !prepared, name: c.name };
    groupTarget[c.id] = existing ? `class:${existing.id}` : `copy:${c.id}`;
  }
  const childOn: State['childOn'] = {};
  for (const c of p.children) {
    // Children who left, and those already enrolled in the new year, are left unticked.
    childOn[c.id] = c.isActive && !c.withdrawn && !c.targetClassroomId && !c.billedInTarget;
  }
  return {
    classes,
    copyCalendar: p.calendar.some((b) => b.entries.length > 0 && b.targetCount === 0),
    percent: '0',
    amounts: Object.fromEntries(p.fees.map((f) => [f.id, String(Number(f.amount))])),
    groupTarget,
    childOn,
    childTarget: {},
    billing: true,
    startDate: p.target.startDate.slice(0, 10),
    extraFees: {},
  };
}

export function YearRolloverPage() {
  const { t, i18n } = useTranslation();
  const { yearId } = useParams<{ yearId: string }>();
  const [fromId, setFromId] = React.useState<string | undefined>();
  const { data: preview, isLoading, isError, error: loadError } = useRolloverPreview(yearId!, fromId);
  const run = useRunRollover(yearId!);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [state, setState] = React.useState<State | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RolloverResult | null>(null);

  React.useEffect(() => {
    if (preview && !result) {
      setState(initialState(preview));
      setStepIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const back = `/admin/settings/academic-years/${yearId}`;
  const dzd = (n: number | string) => formatDZD(Number(n), i18n.language);

  if (isLoading || (preview && !state)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-hover rounded-md w-64 animate-pulse" />
        <div className="h-64 bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }
  if (isError || !preview || !state) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back={back} title={t('yearRollover.title')} />
        <ErrorAlert message={loadError ? errorMessage(loadError, t) : t('academicYears.notFound')} />
      </div>
    );
  }

  const p = preview;
  const target = p.target;
  const set = (patch: Partial<State>) => setState((s) => (s ? { ...s, ...patch } : s));

  // ── Derived ───────────────────────────────────────────────────────────────
  const copied = p.classes.filter((c) => state.classes[c.id]?.on);
  const targetOptions: { value: TargetValue; label: string }[] = [
    ...copied.map((c) => ({ value: `copy:${c.id}`, label: t('yearRollover.children.newClass', { name: state.classes[c.id].name }) })),
    ...p.targetClasses.map((c) => ({ value: `class:${c.id}`, label: c.name })),
    { value: NONE, label: t('yearRollover.children.noClass') },
  ];
  const valid = (v: TargetValue | undefined) => (v && targetOptions.some((o) => o.value === v) ? v : NONE);
  const groupTargetOf = (group: string) => valid(state.groupTarget[group]);
  const childTargetOf = (c: RolloverChild) => valid(state.childTarget[c.id] ?? groupTargetOf(groupOf(c)));
  const chosen = p.children.filter((c) => state.childOn[c.id]);

  const groups = [
    ...p.classes.map((c) => ({ key: c.id, name: c.name })),
    { key: NONE, name: t('yearRollover.children.withoutClass') },
  ]
    .map((g) => ({ ...g, children: p.children.filter((c) => groupOf(c) === g.key) }))
    .filter((g) => g.children.length > 0);

  /** Room left in a class of the new year, and the fees it offers. */
  const targetInfo = (v: TargetValue) => {
    if (v.startsWith('copy:')) {
      const c = p.classes.find((x) => x.id === v.slice(5))!;
      return { capacity: c.capacity, already: 0, feeIds: c.feeIds };
    }
    if (v.startsWith('class:')) {
      const c = p.targetClasses.find((x) => x.id === v.slice(6))!;
      return { capacity: c.capacity, already: c.childCount, feeIds: c.feeIds };
    }
    return null;
  };
  const optionalFees = p.fees.filter((f) => !f.appliesToSchool);
  const schoolFees = p.fees.filter((f) => f.appliesToSchool);
  const offeredFees = (v: TargetValue) => {
    const info = targetInfo(v);
    return info ? optionalFees.filter((f) => info.feeIds.includes(f.id)) : optionalFees;
  };
  const incoming = (v: TargetValue) => chosen.filter((c) => childTargetOf(c) === v).length;
  const usedTargets = [...new Set(chosen.map(childTargetOf))];
  const overCapacity = usedTargets
    .map((v) => ({ v, info: targetInfo(v), n: incoming(v) }))
    .filter(({ info, n }) => info && info.already + n > info.capacity);
  const labelOf = (v: TargetValue) => targetOptions.find((o) => o.value === v)?.label ?? '';

  const feeChanges = p.fees.filter((f) => {
    const n = Number(state.amounts[f.id]);
    return state.amounts[f.id] !== '' && !Number.isNaN(n) && n !== Number(f.amount);
  });
  const calendarToCopy = p.calendar.filter((b) => b.entries.length > 0 && b.targetCount === 0);
  const withUnpaid = chosen.filter((c) => c.unpaid.length > 0);

  function applyPercent(value: string) {
    const pct = Number(value);
    set({
      percent: value,
      amounts: Object.fromEntries(
        p.fees.map((f) => [f.id, String(Number.isNaN(pct) ? Number(f.amount) : Math.round(Number(f.amount) * (1 + pct / 100)))]),
      ),
    });
  }

  function stepError(step: Step): string | null {
    if (step === 'classes' && copied.some((c) => !state!.classes[c.id].name.trim())) {
      return t('yearRollover.classes.nameRequired');
    }
    if (step === 'fees' && p.fees.some((f) => {
      const n = Number(state!.amounts[f.id]);
      return state!.amounts[f.id] === '' || Number.isNaN(n) || n < 0;
    })) {
      return t('yearRollover.fees.amountInvalid');
    }
    if (step === 'children') {
      if (overCapacity.length) {
        return t('yearRollover.children.overCapacity', { name: labelOf(overCapacity[0].v) });
      }
      if (state!.billing && chosen.length && (state!.startDate < target.startDate.slice(0, 10) || state!.startDate > target.endDate.slice(0, 10))) {
        return t('yearRollover.children.startOutside');
      }
    }
    return null;
  }

  function goNext() {
    const err = stepError(STEPS[stepIndex]);
    setError(err);
    if (!err) setStepIndex((i) => i + 1);
  }

  async function handleRun() {
    if (!(await confirm({
      title: t('yearRollover.summary.confirmTitle', { year: iso(target.name) }),
      description: t('yearRollover.summary.confirmDescription'),
      confirmLabel: t('yearRollover.summary.run'),
    }))) return;
    setError(null);
    try {
      const res = await run.mutateAsync({
        sourceYearId: p.source!.id,
        classes: copied.map((c) => ({ sourceClassroomId: c.id, name: state!.classes[c.id].name.trim() })),
        copyCalendar: state!.copyCalendar && calendarToCopy.length > 0,
        feeAmounts: feeChanges.map((f) => ({ feeId: f.id, amount: Number(state!.amounts[f.id]) })),
        children: chosen.map((c) => ({ childId: c.id, target: toTarget(childTargetOf(c)) })),
        billing: state!.billing && chosen.length
          ? {
              startDate: state!.startDate,
              extraFees: usedTargets.map((v) => ({
                target: toTarget(v),
                feeIds: (state!.extraFees[v] ?? []).filter((id) => offeredFees(v).some((f) => f.id === id)),
              })),
            }
          : null,
      });
      setResult(res);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back={back} title={t('yearRollover.title')} description={target.name} />
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-subsection font-semibold">{t('yearRollover.done.title', { year: iso(target.name) })}</h2>
          </div>
          <ul className="text-body text-foreground space-y-1 list-disc ps-5">
            <li>{t('yearRollover.done.classes', { count: result.classesCreated })}</li>
            <li>{t('yearRollover.done.calendar', { count: result.calendarCopied })}</li>
            <li>{t('yearRollover.done.fees', { count: result.feesUpdated })}</li>
            <li>{t('yearRollover.done.placed', { count: result.childrenPlaced })}</li>
            <li>{t('yearRollover.done.billed', { count: result.childrenBilled })}</li>
          </ul>
          <p className="text-caption text-text-secondary">{t('yearRollover.done.activateHint', { year: iso(target.name) })}</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/classrooms" onClick={() => setSelectedYearId(target.id)}>
              <Button type="button">{t('yearRollover.done.seeClasses', { year: iso(target.name) })}</Button>
            </Link>
            <Link to={back}>
              <Button type="button" variant="secondary">{t('yearRollover.done.backToYear')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!p.source) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader back={back} title={t('yearRollover.title')} description={target.name} />
        <p className="text-body text-text-secondary">{t('yearRollover.noSource')}</p>
      </div>
    );
  }

  const step = STEPS[stepIndex];
  const stepLabels: Record<Step, string> = {
    classes: t('yearRollover.steps.classes'),
    fees: t('yearRollover.steps.fees'),
    children: t('yearRollover.steps.children'),
    summary: t('yearRollover.steps.summary'),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDialog}
      <PageHeader
        back={back}
        title={t('yearRollover.title')}
        description={t('yearRollover.description', { target: iso(target.name), source: iso(p.source.name) })}
      />

      {p.otherYears.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="rollover-from" className="text-body text-text-secondary">{t('yearRollover.from')}</label>
          <select
            id="rollover-from"
            value={p.source.id}
            onChange={(e) => { setState(null); setFromId(e.target.value); }}
            className="h-9 rounded-md border border-border bg-card px-2 text-body"
          >
            {p.otherYears.map((y) => (
              <option key={y.id} value={y.id}>{yearLabel(y.name)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Steps */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="space-y-1">
            <div className={cn('h-1 rounded-full', i <= stepIndex ? 'bg-primary' : 'bg-border')} />
            <span className={cn('text-caption', i === stepIndex ? 'text-foreground font-semibold' : 'text-text-secondary')}>
              {i + 1}. {stepLabels[s]}
            </span>
          </li>
        ))}
      </ol>

      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
        {/* ── 1. Classes ─────────────────────────────────────────────────── */}
        {step === 'classes' && (
          <>
            <p className="text-body text-text-secondary">{t('yearRollover.classes.intro', { source: iso(p.source.name), target: iso(target.name) })}</p>
            {p.classes.length === 0 ? (
              <p className="text-body text-text-secondary">{t('yearRollover.classes.none', { source: iso(p.source.name) })}</p>
            ) : (
              <div className="border border-border rounded-md divide-y divide-border">
                {p.classes.map((c) => {
                  const s = state.classes[c.id];
                  const exists = p.targetClasses.some((x) => x.name.trim().toLowerCase() === s.name.trim().toLowerCase());
                  return (
                    <div key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <label className="flex items-center gap-2 sm:w-48 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          className={checkboxClass}
                          checked={s.on}
                          onChange={(e) => set({ classes: { ...state.classes, [c.id]: { ...s, on: e.target.checked } } })}
                        />
                        <span className="text-body font-medium text-foreground">{c.name}</span>
                      </label>
                      <div className="flex-1 min-w-0">
                        <Input
                          aria-label={t('yearRollover.classes.newName', { name: c.name })}
                          value={s.name}
                          disabled={!s.on}
                          onChange={(e) => set({ classes: { ...state.classes, [c.id]: { ...s, name: e.target.value } } })}
                        />
                        {s.on && exists && (
                          <p className="text-micro text-warning mt-1">{t('yearRollover.classes.alreadyExists', { year: iso(target.name) })}</p>
                        )}
                      </div>
                      <div className="text-caption text-text-secondary sm:w-64">
                        {[
                          c.teacher?.name ?? t('yearRollover.classes.noTeacher'),
                          c.room ? t('yearRollover.classes.room', { name: c.room.name }) : null,
                          t('yearRollover.classes.capacity', { count: c.capacity }),
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {p.targetClasses.length > 0 && (
              <p className="text-caption text-text-secondary">
                {t('yearRollover.classes.existing', { year: iso(target.name), names: p.targetClasses.map((c) => c.name).join(', ') })}
              </p>
            )}
            <p className="text-caption text-text-secondary">{t('yearRollover.classes.copiedWhat')}</p>
          </>
        )}

        {/* ── 2. Fees and calendar ───────────────────────────────────────── */}
        {step === 'fees' && (
          <>
            <section className="space-y-2">
              <h2 className="text-subsection font-semibold text-text-heading">{t('yearRollover.fees.calendarTitle')}</h2>
              {p.calendar.every((b) => b.entries.length === 0) ? (
                <p className="text-body text-text-secondary">{t('yearRollover.fees.noCalendar', { source: iso(p.source.name) })}</p>
              ) : (
                p.calendar.filter((b) => b.entries.length > 0).map((b) => (
                  <div key={b.branchId} className="space-y-1">
                    {b.targetCount > 0 ? (
                      <p className="text-body text-text-secondary">{t('yearRollover.fees.calendarExists', { year: iso(target.name) })}</p>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className={checkboxClass}
                          checked={state.copyCalendar}
                          onChange={(e) => set({ copyCalendar: e.target.checked })}
                        />
                        <span className="text-body text-foreground">{t('yearRollover.fees.copyCalendar', { count: b.entries.length })}</span>
                      </label>
                    )}
                    {b.targetCount === 0 && (
                      <ul className="text-caption text-text-secondary ps-6 space-y-0.5">
                        {b.entries.map((e, i) => (
                          <li key={i}>
                            {e.label} : <span dir="ltr">{formatDate(e.periodStart)}</span> – <span dir="ltr">{formatDate(e.periodEnd)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="space-y-2 pt-2 border-t border-border">
              <h2 className="text-subsection font-semibold text-text-heading">{t('yearRollover.fees.title')}</h2>
              {p.fees.length === 0 ? (
                <p className="text-body text-text-secondary">{t('yearRollover.fees.none')}</p>
              ) : (
                <>
                  <div className="flex items-end gap-2 flex-wrap">
                    <FormField label={t('yearRollover.fees.percent')} htmlFor="rollover-percent" className="mb-0">
                      <Input
                        id="rollover-percent"
                        type="number"
                        min={-50}
                        max={100}
                        step="0.5"
                        value={state.percent}
                        onChange={(e) => applyPercent(e.target.value)}
                        className="w-28"
                      />
                    </FormField>
                  </div>
                  <div className="border border-border rounded-md divide-y divide-border">
                    {p.fees.map((f) => (
                      <div key={f.id} className="p-2 flex items-center gap-3">
                        <span className="flex-1 min-w-0 text-body text-foreground truncate">{f.name}</span>
                        <span className="text-caption text-text-secondary whitespace-nowrap">{dzd(f.amount)}</span>
                        <span className="text-caption text-text-secondary">→</span>
                        <Input
                          aria-label={t('yearRollover.fees.newAmount', { name: f.name })}
                          type="number"
                          min={0}
                          step="1"
                          value={state.amounts[f.id]}
                          onChange={(e) => set({ amounts: { ...state.amounts, [f.id]: e.target.value } })}
                          className="w-32"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-caption text-text-secondary">{t('yearRollover.fees.sharedNote')}</p>
                </>
              )}
            </section>
          </>
        )}

        {/* ── 3. Children ────────────────────────────────────────────────── */}
        {step === 'children' && (
          <>
            <p className="text-body text-text-secondary">{t('yearRollover.children.intro', { source: iso(p.source.name), target: iso(target.name) })}</p>
            {groups.length === 0 && (
              <p className="text-body text-text-secondary">{t('yearRollover.children.none', { source: iso(p.source.name) })}</p>
            )}
            {groups.map((g) => {
              const gt = groupTargetOf(g.key);
              const info = targetInfo(gt);
              const n = incoming(gt);
              return (
                <section key={g.key} className="border border-border rounded-md">
                  <div className="p-3 bg-subtle flex flex-col sm:flex-row sm:items-center gap-2 rounded-t-md">
                    <span className="text-body font-semibold text-foreground flex-1">{g.name}</span>
                    <label className="flex items-center gap-2 text-caption text-text-secondary">
                      {t('yearRollover.children.goesTo')}
                      <select
                        value={gt}
                        onChange={(e) => set({ groupTarget: { ...state.groupTarget, [g.key]: e.target.value } })}
                        className="h-9 rounded-md border border-border bg-card px-2 text-body text-foreground max-w-[14rem]"
                      >
                        {targetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>
                  {info && info.already + n > info.capacity && (
                    <p className="px-3 pt-2 text-caption text-warning flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t('yearRollover.children.capacityWarning', { name: labelOf(gt), count: info.already + n, capacity: info.capacity })}
                    </p>
                  )}
                  <ul className="divide-y divide-border">
                    {g.children.map((c) => {
                      const done = !!c.targetClassroomId || c.billedInTarget;
                      const ct = childTargetOf(c);
                      return (
                        <li key={c.id} className="p-2 ps-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              className={checkboxClass}
                              checked={!!state.childOn[c.id]}
                              onChange={(e) => set({ childOn: { ...state.childOn, [c.id]: e.target.checked } })}
                            />
                            <span className="text-body text-foreground truncate">{c.firstName} {c.lastName}</span>
                            {(c.withdrawn || !c.isActive) && (
                              <span className="text-micro text-text-secondary">{t('yearRollover.children.left')}</span>
                            )}
                            {done && (
                              <span className="text-micro text-primary">{t('yearRollover.children.already', { year: iso(target.name) })}</span>
                            )}
                          </label>
                          {c.unpaid.map((u) => (
                            <span key={u.id} className="text-micro text-danger whitespace-nowrap">
                              {t('yearRollover.children.unpaid', { year: iso(u.name), amount: dzd(u.amount) })}
                            </span>
                          ))}
                          {state.childOn[c.id] && (
                            <select
                              aria-label={t('yearRollover.children.classOf', { name: c.firstName })}
                              value={ct}
                              onChange={(e) => set({ childTarget: { ...state.childTarget, [c.id]: e.target.value } })}
                              className={cn(
                                'h-8 rounded-md border border-border bg-card px-2 text-caption max-w-[12rem]',
                                ct !== gt ? 'text-primary font-medium' : 'text-text-secondary',
                              )}
                            >
                              {targetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {chosen.length > 0 && (
              <section className="space-y-3 pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className={checkboxClass} checked={state.billing} onChange={(e) => set({ billing: e.target.checked })} />
                  <span className="text-body font-medium text-foreground">{t('yearRollover.children.bill', { year: iso(target.name) })}</span>
                </label>
                {state.billing && (
                  <>
                    <FormField label={t('yearRollover.children.startDate')} htmlFor="rollover-start" className="max-w-xs">
                      <Input
                        id="rollover-start"
                        type="date"
                        value={state.startDate}
                        min={target.startDate.slice(0, 10)}
                        max={target.endDate.slice(0, 10)}
                        onChange={(e) => set({ startDate: e.target.value })}
                      />
                    </FormField>
                    <p className="text-caption text-text-secondary">
                      {t('yearRollover.children.feesKept')}
                      {schoolFees.length > 0 && ` ${t('yearRollover.children.schoolFees', { names: schoolFees.map((f) => f.name).join(', ') })}`}
                    </p>
                    {usedTargets.map((v) => {
                      const fees = offeredFees(v);
                      if (fees.length === 0) return null;
                      const picked = state.extraFees[v] ?? [];
                      return (
                        <div key={v} className="space-y-1">
                          <p className="text-caption font-medium text-foreground">
                            {t('yearRollover.children.extraFees', { name: labelOf(v), count: incoming(v) })}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {fees.map((f) => (
                              <label key={f.id} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className={checkboxClass}
                                  checked={picked.includes(f.id)}
                                  onChange={(e) => set({
                                    extraFees: {
                                      ...state.extraFees,
                                      [v]: e.target.checked ? [...picked, f.id] : picked.filter((x) => x !== f.id),
                                    },
                                  })}
                                />
                                <span className="text-caption text-foreground">{f.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {/* ── 4. Summary ─────────────────────────────────────────────────── */}
        {step === 'summary' && (
          <>
            <p className="text-body text-text-secondary">{t('yearRollover.summary.intro', { target: iso(target.name) })}</p>
            <ul className="text-body text-foreground space-y-1.5 list-disc ps-5">
              <li>
                {t('yearRollover.summary.classes', { count: copied.length })}
                {copied.length > 0 && <span className="text-text-secondary"> : {copied.map((c) => state.classes[c.id].name.trim()).join(', ')}</span>}
              </li>
              <li>
                {state.copyCalendar && calendarToCopy.length
                  ? t('yearRollover.summary.calendar', { count: calendarToCopy.reduce((n, b) => n + b.entries.length, 0) })
                  : t('yearRollover.summary.noCalendar')}
              </li>
              <li>
                {t('yearRollover.summary.fees', { count: feeChanges.length })}
                {feeChanges.length > 0 && (
                  <span className="text-text-secondary">
                    {' : '}
                    {feeChanges.map((f) => `${f.name} ${dzd(f.amount)} → ${dzd(state.amounts[f.id])}`).join(' ; ')}
                  </span>
                )}
              </li>
              <li>
                {t('yearRollover.summary.children', { count: chosen.length })}
                {usedTargets.length > 0 && (
                  <span className="text-text-secondary">
                    {' : '}
                    {usedTargets.map((v) => `${labelOf(v)} (${incoming(v)})`).join(', ')}
                  </span>
                )}
              </li>
              {chosen.length > 0 && (
                <li>
                  {state.billing
                    ? t('yearRollover.summary.billed', { date: formatDate(state.startDate) })
                    : t('yearRollover.summary.notBilled')}
                </li>
              )}
            </ul>
            {withUnpaid.length > 0 && (
              <p className="text-caption text-text-secondary flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                {t('yearRollover.summary.unpaid', { count: withUnpaid.length })}
              </p>
            )}
          </>
        )}

        <ErrorAlert message={error} />

        <div className="flex justify-between gap-2 pt-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="secondary" onClick={() => { setError(null); setStepIndex((i) => i - 1); }}>
              {t('common.back')}
            </Button>
          ) : (
            <Link to={back}><Button type="button" variant="secondary">{t('common.cancel')}</Button></Link>
          )}
          {step !== 'summary' ? (
            <Button type="button" onClick={goNext}>{t('yearRollover.next')}</Button>
          ) : (
            <Button type="button" onClick={handleRun} disabled={run.isPending}>
              {run.isPending ? t('yearRollover.summary.running') : t('yearRollover.summary.run')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
