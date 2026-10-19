import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Rocket, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminDashboard as Dashboard } from '@/hooks/useAdminDashboard';

type Step = keyof Dashboard['setup'];

/** In the order a new school sets itself up, each with where it is done. */
const STEPS: { key: Step; to: string }[] = [
  { key: 'year', to: '/admin/settings?tab=years' },
  { key: 'rooms', to: '/admin/settings?tab=rooms' },
  { key: 'classes', to: '/admin/classrooms' },
  { key: 'fees', to: '/admin/payments?tab=config' },
  { key: 'team', to: '/admin/users' },
  { key: 'children', to: '/admin/children' },
];

const hiddenKey = (schoolId: string) => `kiddoo:first-steps-hidden:${schoolId}`;

function readHidden(schoolId: string): boolean {
  try {
    return localStorage.getItem(hiddenKey(schoolId)) === '1';
  } catch {
    return false;
  }
}

/**
 * A new school's first steps on the director's dashboard: each one ticks
 * itself when done, and the card goes once all are (or when put away).
 */
export function FirstSteps({ setup }: { setup: Dashboard['setup'] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const schoolId = user?.schoolId ?? '';
  const [hidden, setHidden] = React.useState(() => readHidden(schoolId));

  const done = STEPS.filter((s) => setup[s.key]).length;
  if (hidden || done === STEPS.length) return null;
  const next = STEPS.find((s) => !setup[s.key]);

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(schoolId), '1');
    } catch {
      // No device storage: it shows again next time, nothing else.
    }
  }

  return (
    <section className="bg-card border border-border rounded-2xl p-5 sm:p-6" aria-labelledby="first-steps-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] text-primary">
            <Rocket className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 id="first-steps-title" className="text-subsection font-semibold text-text-heading">
              {t('dashboard.admin.firstSteps.title')}
            </h2>
            <p className="text-caption text-text-secondary">
              {t('dashboard.admin.firstSteps.progress', { done, total: STEPS.length })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label={t('dashboard.admin.firstSteps.hide')}
          title={t('dashboard.admin.firstSteps.hide')}
          className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-text-disabled hover:text-text-primary hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-subtle overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>

      <ol className="mt-4 divide-y divide-border">
        {STEPS.map((step, i) => {
          const isDone = setup[step.key];
          const isNext = step.key === next?.key;
          return (
            <li key={step.key}>
              <Link
                to={step.to}
                className={cn(
                  'flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-hover focus-visible:outline-none focus-visible:shadow-focus-ring',
                  isDone && 'text-text-secondary',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 grid place-items-center w-7 h-7 rounded-full text-caption font-semibold',
                    isDone
                      ? 'bg-[var(--color-success)] text-[var(--color-text-inverse)]'
                      : isNext
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-subtle text-text-secondary',
                  )}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-body', isDone ? 'line-through decoration-text-disabled' : 'font-medium text-text-heading')}>
                    {t(`dashboard.admin.firstSteps.steps.${step.key}.title`)}
                  </span>
                  {!isDone && (
                    <span className="block text-caption text-text-secondary">
                      {t(`dashboard.admin.firstSteps.steps.${step.key}.hint`)}
                    </span>
                  )}
                </span>
                <span className="sr-only">{isDone ? t('dashboard.admin.firstSteps.done') : ''}</span>
                {!isDone && <ChevronRight className="w-4 h-4 shrink-0 text-text-disabled rtl:rotate-180" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
