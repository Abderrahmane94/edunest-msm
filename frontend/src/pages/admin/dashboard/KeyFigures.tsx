import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AdminDashboard as Dashboard } from '@/hooks/useAdminDashboard';
import { usePermissions } from '@/lib/roles';
import { useNumbers } from './theme';

// ─── Small pictures, in the logo's colors ───

const svg = { viewBox: '0 0 64 64', className: 'w-16 h-16 sm:w-[72px] sm:h-[72px]', 'aria-hidden': true } as const;

/** A smiling child under the sun. */
function ChildPicture() {
  return (
    <svg {...svg}>
      <circle cx="50" cy="14" r="8" fill="#FFC145" />
      <circle cx="28" cy="30" r="15" fill="#FFD9B8" />
      <path d="M13 28c1-10 8-16 16-16s14 5 15 14c-6-1-11-4-14-8-3 5-9 9-17 10z" fill="#8A5A3C" />
      <circle cx="23" cy="32" r="1.8" fill="#3A2A4D" />
      <circle cx="34" cy="32" r="1.8" fill="#3A2A4D" />
      <path d="M23 38c3 3.5 8 3.5 11 0" fill="none" stroke="#E2457A" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 62c2-11 10-16 20-16s18 5 20 16z" fill="#5B55D6" />
    </svg>
  );
}

/** Three children side by side. */
function GroupPicture() {
  return (
    <svg {...svg}>
      <circle cx="14" cy="26" r="8" fill="#FFD9B8" />
      <path d="M2 54c1-10 6-15 12-15s11 5 12 15z" fill="#2F8FDB" />
      <circle cx="50" cy="26" r="8" fill="#FFD9B8" />
      <path d="M38 54c1-10 6-15 12-15s11 5 12 15z" fill="#16A99F" />
      <circle cx="32" cy="22" r="10" fill="#FFE3C7" />
      <path d="M16 58c2-13 8-19 16-19s14 6 16 19z" fill="#F47B8C" />
      <path d="M22 20c1-7 5-10 10-10s9 3 10 9c-4 0-7-2-9-5-2 3-6 5-11 6z" fill="#8A5A3C" />
    </svg>
  );
}

/** Stacked coins and a banknote. */
function MoneyPicture() {
  return (
    <svg {...svg}>
      <rect x="6" y="14" width="40" height="24" rx="4" fill="#8FD9B6" />
      <rect x="6" y="14" width="40" height="24" rx="4" fill="none" stroke="#16956C" strokeWidth="2" />
      <circle cx="26" cy="26" r="6" fill="#16956C" />
      <ellipse cx="44" cy="54" rx="14" ry="5" fill="#E09400" />
      <ellipse cx="44" cy="50" rx="14" ry="5" fill="#FFC145" />
      <ellipse cx="44" cy="45" rx="14" ry="5" fill="#E09400" />
      <ellipse cx="44" cy="41" rx="14" ry="5" fill="#FFC145" />
      <ellipse cx="44" cy="36" rx="14" ry="5" fill="#E09400" />
      <ellipse cx="44" cy="32" rx="14" ry="5" fill="#FFD77A" />
    </svg>
  );
}

/** An alarm clock: something is late. */
function ClockPicture({ calm }: { calm: boolean }) {
  const body = calm ? '#16956C' : '#E2457A';
  return (
    <svg {...svg}>
      <circle cx="14" cy="12" r="7" fill="#FFC145" />
      <circle cx="50" cy="12" r="7" fill="#FFC145" />
      <path d="M16 56l-5 6M48 56l5 6" stroke={body} strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="36" r="24" fill={body} />
      <circle cx="32" cy="36" r="18" fill="#FFFFFF" />
      {calm ? (
        <path d="M23 37l6 6 12-13" fill="none" stroke={body} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M32 24v13l8 5" fill="none" stroke="#3A2A4D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// ─── The cards ───

type Look = 'violet' | 'sky' | 'green' | 'pink';
const LOOK: Record<Look, string> = {
  violet: 'bg-[var(--color-accent-subtle)] border-[var(--color-accent-muted)]',
  sky: 'bg-[var(--color-sky-muted)]/60 border-[var(--color-sky-muted)]',
  green: 'bg-[var(--color-success-subtle)] border-[var(--color-success-muted)]',
  pink: 'bg-[var(--color-danger-subtle)] border-[var(--color-danger-muted)]',
};

function Figure({ look, label, value, sub, to, picture }: { look: Look; label: string; value: React.ReactNode; sub: string; to: string; picture: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'relative overflow-hidden flex items-center gap-3 rounded-2xl border p-4 sm:p-5 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-level-3 focus-visible:outline-none focus-visible:shadow-focus-ring',
        LOOK[look],
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-label font-semibold text-text-secondary">{label}</span>
        <span className="mt-1 block font-playful text-page-title sm:text-display font-bold leading-none text-text-heading tabular-nums whitespace-nowrap rtl:text-end" dir="ltr">
          {value}
        </span>
        <span className="mt-1.5 block text-caption text-text-secondary">{sub}</span>
      </span>
      <span className="shrink-0">{picture}</span>
    </Link>
  );
}

/** The four figures the school lives by, at the top of the dashboard. */
export function KeyFigures({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const n = useNumbers();
  const { can } = usePermissions();
  const a = data.attendance;
  const late = data.finance.late;
  const figures: React.ReactNode[] = [];

  if (can('classes')) {
    figures.push(
      <Figure
        key="present"
        look="violet"
        label={t('dashboard.key.present')}
        value={a.isSchoolDay ? `${a.present + a.late} / ${a.expected}` : '—'}
        sub={a.isSchoolDay ? t('dashboard.key.presentSub', { count: a.absent }) : t('dashboard.key.noSchool')}
        to="/admin/attendance"
        picture={<ChildPicture />}
      />,
    );
  }
  if (can('children')) {
    figures.push(
      <Figure
        key="children"
        look="sky"
        label={t('dashboard.key.children')}
        value={n.number(data.enrollment.activeChildren)}
        sub={t('dashboard.key.childrenSub', { count: data.enrollment.newThisMonth })}
        to="/admin/children"
        picture={<GroupPicture />}
      />,
    );
  }
  if (can('collections')) {
    figures.push(
      <Figure
        key="collected"
        look="green"
        label={t('dashboard.key.collected')}
        value={n.money(data.finance.collected)}
        sub={t('dashboard.key.collectedSub')}
        to="/admin/payments"
        picture={<MoneyPicture />}
      />,
      <Figure
        key="late"
        look={late.amount > 0 ? 'pink' : 'green'}
        label={t('dashboard.key.late')}
        value={n.money(late.amount)}
        sub={late.amount > 0 ? t('dashboard.key.lateSub', { count: late.children }) : t('dashboard.key.lateNone')}
        to="/admin/payments?tab=late"
        picture={<ClockPicture calm={late.amount === 0} />}
      />,
    );
  }
  if (figures.length === 0) return null;
  // Four across only where an amount and its picture fit side by side.
  return <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">{figures}</div>;
}
