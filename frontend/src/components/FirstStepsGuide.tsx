import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, PartyPopper, Rocket, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { STEPS, isStepPage, useFirstStepsHidden, useSetup, type Step } from '@/lib/firstSteps';

/**
 * The director's first steps, following them from page to page (the
 * dashboard has its own card): a pill in the corner that opens the list,
 * ticks a step as soon as it is done, and offers the next one.
 */
export function FirstStepsGuide() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const isDirector = user?.role === 'admin' && !!user.schoolId;
  const [hidden, hide] = useFirstStepsHidden(user?.schoolId ?? '');
  const { data: setup, refetch } = useSetup(isDirector && !hidden);
  const [open, setOpen] = React.useState(false);
  const [justDone, setJustDone] = React.useState<Step | null>(null);
  const previous = React.useRef<typeof setup>(undefined);

  // Saved something anywhere, or moved to another page: maybe a step is done.
  React.useEffect(() => {
    if (!isDirector || hidden) return;
    return qc.getMutationCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'success') void qc.invalidateQueries({ queryKey: ['admin', 'setup'] });
    });
  }, [qc, isDirector, hidden]);
  React.useEffect(() => {
    if (isDirector && !hidden) void refetch();
  }, [location.pathname, location.search, isDirector, hidden, refetch]);

  // A step that just got done: the guide opens on it, with the next one.
  React.useEffect(() => {
    const before = previous.current;
    previous.current = setup;
    if (!before || !setup) return;
    const ticked = STEPS.find((s) => setup[s.key] && !before[s.key]);
    if (ticked) {
      setJustDone(ticked.key);
      setOpen(true);
    }
  }, [setup]);

  if (!isDirector || hidden || !setup) return null;
  const done = STEPS.filter((s) => setup[s.key]).length;
  const allDone = done === STEPS.length;
  // Gone once all are done (after saying so), and never over the dashboard's own card.
  if ((allDone && !justDone) || location.pathname === '/admin') return null;
  const next = STEPS.find((s) => !setup[s.key]);
  const here = STEPS.find((s) => isStepPage(s, location.pathname, location.search));

  const position = 'fixed z-40 end-4 bottom-[calc(var(--tabbar-h)+1rem)] lg:end-6 lg:bottom-6';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('dashboard.admin.firstSteps.guide.open')}
        className={cn(
          position,
          'flex items-center gap-2 rounded-full bg-primary ps-3 pe-4 py-2 text-caption font-semibold text-primary-foreground shadow-level-4 hover:opacity-95 focus-visible:outline-none focus-visible:shadow-focus-ring',
        )}
      >
        <Rocket className="w-4 h-4" />
        {t('dashboard.admin.firstSteps.title')}
        <span className="rounded-full bg-white/20 px-2 py-0.5" dir="ltr">{`${done}/${STEPS.length}`}</span>
      </button>
    );
  }

  return (
    <section
      aria-labelledby="first-steps-guide-title"
      className={cn(position, 'w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-level-4')}
    >
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-accent-subtle)] text-primary">
          <Rocket className="w-4 h-4" />
        </span>
        <h2 id="first-steps-guide-title" className="flex-1 min-w-0 text-body font-semibold text-text-heading">
          {t('dashboard.admin.firstSteps.title')}{' '}
          <span className="text-caption font-medium text-text-secondary" dir="ltr">{`${done}/${STEPS.length}`}</span>
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setJustDone(null);
          }}
          aria-label={t('dashboard.admin.firstSteps.guide.close')}
          title={t('dashboard.admin.firstSteps.guide.close')}
          className="grid place-items-center w-7 h-7 rounded-full text-text-disabled hover:text-text-primary hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={hide}
          aria-label={t('dashboard.admin.firstSteps.hide')}
          title={t('dashboard.admin.firstSteps.hide')}
          className="grid place-items-center w-7 h-7 rounded-full text-text-disabled hover:text-text-primary hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-subtle overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>

      {justDone && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--color-success)]/10 px-3 py-2 text-caption font-medium text-[var(--color-success)]" role="status">
          <PartyPopper className="w-4 h-4 shrink-0" />
          {allDone
            ? t('dashboard.admin.firstSteps.guide.allDone')
            : t('dashboard.admin.firstSteps.guide.justDone', { step: t(`dashboard.admin.firstSteps.steps.${justDone}.title`) })}
        </p>
      )}

      <ol className="mt-2">
        {STEPS.map((step, i) => {
          const isDone = setup[step.key];
          const isNext = step.key === next?.key;
          const isHere = step.key === here?.key;
          return (
            <li key={step.key}>
              <Link
                to={step.to}
                aria-current={isHere ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 -mx-2 px-2 py-1.5 rounded-lg text-caption hover:bg-hover focus-visible:outline-none focus-visible:shadow-focus-ring',
                  isHere && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'grid place-items-center w-5 h-5 shrink-0 rounded-full text-micro font-semibold',
                    isDone
                      ? 'bg-[var(--color-success)] text-[var(--color-text-inverse)]'
                      : isNext
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-subtle text-text-secondary',
                  )}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('flex-1 min-w-0', isDone ? 'text-text-secondary line-through decoration-text-disabled' : 'font-medium text-text-heading')}>
                  {t(`dashboard.admin.firstSteps.steps.${step.key}.title`)}
                </span>
                {isHere && <span className="shrink-0 text-micro font-semibold text-primary">{t('dashboard.admin.firstSteps.guide.here')}</span>}
                <span className="sr-only">{isDone ? t('dashboard.admin.firstSteps.done') : ''}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {next && next.key !== here?.key && (
        <Link
          to={next.to}
          onClick={() => setJustDone(null)}
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-caption font-semibold text-primary-foreground hover:opacity-95 focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          {t('dashboard.admin.firstSteps.guide.next', { step: t(`dashboard.admin.firstSteps.steps.${next.key}.title`) })}
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Link>
      )}
      {next && next.key === here?.key && (
        <p className="mt-3 text-caption text-text-secondary">{t(`dashboard.admin.firstSteps.steps.${next.key}.hint`)}</p>
      )}
    </section>
  );
}
