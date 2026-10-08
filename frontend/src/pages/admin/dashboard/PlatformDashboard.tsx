import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Hourglass,
  MessageCircle,
  Moon,
  PieChart,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  usePlatformDashboard,
  type PlatformDashboard as Dashboard,
  type PlatformSchoolRow,
  type SchoolAlert,
  type SchoolState,
} from '@/hooks/useAdminDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIn } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ActionList, BarChart, BigNumber, ChevronIcon, Progress, Section, Tile, type ActionItem } from './parts';
import { TONE_FILL, TONE_ICON, useNumbers, type Tone } from './theme';

const STATE_TONE: Record<SchoolState, Tone> = {
  active: 'success',
  trial: 'accent',
  overdue: 'danger',
  none: 'warning',
  cancelled: 'neutral',
  suspended: 'neutral',
  disabled: 'neutral',
};
const STATE_ORDER: SchoolState[] = ['active', 'trial', 'overdue', 'none', 'suspended', 'cancelled', 'disabled'];

const ALERT_TONE: Record<SchoolAlert, Tone> = {
  overdue: 'danger',
  renewalDue: 'warning',
  trialEnding: 'warning',
  overLimit: 'danger',
  noSubscription: 'warning',
  dormant: 'neutral',
};
const ALERT_ICON: Record<SchoolAlert, React.ReactNode> = {
  overdue: <AlertOctagon className="w-4 h-4" />,
  renewalDue: <CalendarClock className="w-4 h-4" />,
  trialEnding: <Hourglass className="w-4 h-4" />,
  overLimit: <Users className="w-4 h-4" />,
  noSubscription: <CreditCard className="w-4 h-4" />,
  dormant: <Moon className="w-4 h-4" />,
};
const ALERT_ORDER: SchoolAlert[] = ['overdue', 'renewalDue', 'trialEnding', 'overLimit', 'noSubscription', 'dormant'];

const DAY_MS = 24 * 60 * 60 * 1000;

function StateBadge({ state }: { state: SchoolState }) {
  const { t } = useTranslation();
  const tone = STATE_TONE[state];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-micro font-semibold', TONE_ICON[tone])}>
      {t(`dashboard.platform.table.states.${state}`)}
    </span>
  );
}

// ─── Sections ───

function TodoList({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const items: ActionItem[] = [];

  for (const alert of ALERT_ORDER) {
    const schools = data.schoolRows.filter((s) => s.alerts.includes(alert));
    if (schools.length === 0) continue;
    const names = schools.slice(0, 3).map((s) => s.name).join(', ') + (schools.length > 3 ? ` +${schools.length - 3}` : '');
    const billing = alert !== 'dormant';
    items.push({
      key: alert,
      tone: ALERT_TONE[alert],
      icon: ALERT_ICON[alert],
      text: t(`dashboard.platform.todo.${alert}`, { schools: names }),
      to:
        schools.length === 1
          ? `/admin/schools/${schools[0].id}`
          : billing
            ? '/admin/billing?tab=subscriptions'
            : '/admin/schools',
    });
  }

  return (
    <ActionList title={t('dashboard.platform.todo.title')} allGood={t('dashboard.platform.todo.allGood')} items={items} />
  );
}

function RevenueSection({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const n = useNumbers();
  const r = data.revenue;
  const change =
    r.collectedPreviousMonth > 0
      ? Math.round(((r.collectedThisMonth - r.collectedPreviousMonth) / r.collectedPreviousMonth) * 100)
      : null;
  const bars = r.monthly.map((m) => ({
    key: m.month,
    label: formatDateIn(`${m.month}-01`, i18n.language, { month: 'short' }),
    value: m.collected,
    display: n.compact(m.collected),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          icon={<TrendingUp className="w-[18px] h-[18px]" />}
          tone="accent"
          title={t('dashboard.platform.revenue.mrr')}
          to="/admin/billing?tab=subscriptions"
        >
          <BigNumber value={n.money(r.mrr)} />
          <p className="mt-2 text-caption text-text-secondary">{t('dashboard.platform.revenue.mrrHint')}</p>
        </Tile>

        <Tile
          icon={<Wallet className="w-[18px] h-[18px]" />}
          tone="success"
          title={t('dashboard.platform.revenue.collected')}
          to="/admin/billing?tab=payments"
        >
          <BigNumber value={n.money(r.collectedThisMonth)} />
          <p className="mt-2 text-caption text-text-secondary flex items-center gap-1">
            {change == null ? (
              t('dashboard.platform.revenue.noPrevious')
            ) : (
              <>
                <span
                  className={cn('inline-flex items-center font-semibold', change >= 0 ? 'text-success' : 'text-danger')}
                  dir="ltr"
                >
                  {change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {change >= 0 ? '+' : ''}
                  {change} %
                </span>
                {t('dashboard.platform.revenue.vsLastMonth')}
              </>
            )}
          </p>
        </Tile>

        <Tile
          icon={<Clock className="w-[18px] h-[18px]" />}
          tone={r.overdueCount > 0 ? 'danger' : 'success'}
          title={t('dashboard.platform.revenue.overdue')}
          to="/admin/billing?tab=subscriptions"
          className="sm:col-span-2 lg:col-span-1"
        >
          <BigNumber value={n.money(r.overdueAmount)} tone={r.overdueCount > 0 ? 'danger' : 'success'} />
          <p className="mt-2 text-caption text-text-secondary">
            {r.overdueCount > 0
              ? t('dashboard.platform.revenue.overdueHint', { count: r.overdueCount })
              : t('dashboard.platform.revenue.noOverdue')}
          </p>
        </Tile>
      </div>

      <Tile
        icon={<Receipt className="w-[18px] h-[18px]" />}
        tone="accent"
        title={t('dashboard.platform.revenue.chart')}
        to="/admin/billing?tab=payments"
      >
        <BarChart bars={bars} tone="accent" emptyLabel={t('dashboard.platform.revenue.noRevenue')} />
      </Tile>
    </div>
  );
}

function SchoolsSection({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const s = data.schools;
  const total = Math.max(s.total, 1);
  const bars = s.growth.map((g) => ({
    key: g.month,
    label: formatDateIn(`${g.month}-01`, i18n.language, { month: 'short' }),
    value: g.created,
    display: String(g.created),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <Tile icon={<Building2 className="w-[18px] h-[18px]" />} tone="accent" title={t('dashboard.platform.schools.total')} to="/admin/schools">
        <BigNumber value={String(s.total)} />
        <p className="mt-2 text-caption text-text-secondary">
          {t('dashboard.platform.schools.newThisMonth', { count: s.newThisMonth })}
        </p>
        <p className="mt-1 text-caption text-text-secondary">
          {t('dashboard.platform.usage.children')} :{' '}
          <span className="font-semibold text-text-heading">{data.usage.totalChildren}</span>
        </p>
      </Tile>

      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONE_ICON.success)}>
            <PieChart className="w-[18px] h-[18px]" />
          </div>
          <p className="text-label font-medium text-text-secondary">{t('dashboard.platform.schools.breakdown')}</p>
        </div>
        <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-subtle">
          {STATE_ORDER.map((state) =>
            s.byState[state] > 0 ? (
              <div
                key={state}
                className={cn('h-full', state === 'disabled' ? 'bg-[var(--color-border)]' : TONE_FILL[STATE_TONE[state]])}
                style={{ width: `${(s.byState[state] / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {STATE_ORDER.map((state) => (
            <li key={state} className="flex items-center gap-1.5 text-caption text-text-secondary">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  state === 'disabled' ? 'bg-[var(--color-border)]' : TONE_FILL[STATE_TONE[state]],
                )}
              />
              <span className="truncate">{t(`dashboard.platform.schools.states.${state}`)}</span>
              <span className="ms-auto font-semibold text-text-heading">{s.byState[state]}</span>
            </li>
          ))}
        </ul>
      </div>

      <Tile
        icon={<TrendingUp className="w-[18px] h-[18px]" />}
        tone="accent"
        title={t('dashboard.platform.schools.growth')}
        to="/admin/schools"
        className="md:col-span-2 xl:col-span-1"
      >
        <BarChart bars={bars} tone="accent" emptyLabel={t('dashboard.platform.schools.noGrowth')} />
      </Tile>
    </div>
  );
}

function UsageSection({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const n = useNumbers();
  const u = data.usage;
  const roles = ['admin', 'teacher', 'parent'] as const;
  const active = roles.reduce((sum, r) => sum + u.activeUsers[r], 0);
  const total = roles.reduce((sum, r) => sum + u.totalUsers[r], 0);
  const activity = [
    { key: 'attendance', icon: <ClipboardCheck className="w-4 h-4" />, tone: 'success' as Tone, value: u.lastWeek.attendance },
    { key: 'dailyReports', icon: <FileText className="w-4 h-4" />, tone: 'accent' as Tone, value: u.lastWeek.dailyReports },
    { key: 'messages', icon: <MessageCircle className="w-4 h-4" />, tone: 'warning' as Tone, value: u.lastWeek.messages },
    { key: 'payments', icon: <Wallet className="w-4 h-4" />, tone: 'success' as Tone, value: u.lastWeek.payments },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Tile icon={<UserCheck className="w-[18px] h-[18px]" />} tone="success" title={t('dashboard.platform.usage.activeUsers')} to="/admin/users">
        <BigNumber value={n.number(active)} suffix={t('dashboard.platform.usage.activeOf', { total })} />
        <ul className="mt-4 space-y-2.5">
          {roles.map((role) => (
            <li key={role}>
              <div className="flex items-center justify-between text-caption mb-1">
                <span className="text-text-secondary">{t(`dashboard.platform.usage.roles.${role}`)}</span>
                <span className="font-medium text-text-heading" dir="ltr">
                  {u.activeUsers[role]}/{u.totalUsers[role]}
                </span>
              </div>
              <Progress
                value={u.totalUsers[role] > 0 ? (u.activeUsers[role] / u.totalUsers[role]) * 100 : 0}
                tone="success"
              />
            </li>
          ))}
        </ul>
      </Tile>

      <div className="lg:col-span-2 grid grid-cols-2 gap-4">
        {activity.map((a) => (
          <div key={a.key} className="bg-card border border-border rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', TONE_ICON[a.tone])}>{a.icon}</div>
            <div>
              <p className="text-page-title font-bold text-text-heading leading-none">
                <span dir="ltr">{n.number(a.value)}</span>
              </p>
              <p className="mt-1.5 text-caption text-text-secondary">{t(`dashboard.platform.usage.${a.key}`)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LastActive({ row, today }: { row: PlatformSchoolRow; today: string }) {
  const { t, i18n } = useTranslation();
  if (!row.lastActiveAt) return <span className="text-text-disabled">{t('dashboard.platform.table.never')}</span>;
  // Whole days between the school's dates (Algiers), like the server's "today".
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date(row.lastActiveAt));
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(day)) / DAY_MS));
  return (
    <span
      className={days >= 14 ? 'text-danger' : 'text-text-heading'}
      title={formatDateIn(row.lastActiveAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}
    >
      {days === 0 ? t('dashboard.platform.table.today') : t('dashboard.platform.table.daysAgo', { count: days })}
    </span>
  );
}

function Usage({ value, max }: { value: number; max: number | null }) {
  const ratio = max ? value / max : 0;
  const tone: Tone = max == null ? 'accent' : ratio > 1 ? 'danger' : ratio >= 0.85 ? 'warning' : 'accent';
  return (
    <div className="min-w-0">
      <span className={cn('text-caption font-medium', ratio > 1 ? 'text-danger' : 'text-text-heading')} dir="ltr">
        {value}
        {max != null && <span className="text-text-secondary font-normal">/{max}</span>}
      </span>
      {max != null && (
        <div className="mt-1 max-w-[96px]">
          <Progress value={ratio * 100} tone={tone} />
        </div>
      )}
    </div>
  );
}

function SchoolsTable({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const rows = data.schoolRows;
  const cols = 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_16px] md:items-center md:gap-4';
  const label = (key: string) => (
    <span className="md:hidden text-micro text-text-secondary">{t(`dashboard.platform.table.${key}`)}</span>
  );

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-6 text-center text-body text-text-secondary">
        {t('dashboard.platform.table.empty')}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className={cn('hidden px-4 py-2.5 border-b border-border bg-subtle text-micro font-semibold uppercase tracking-wide text-text-secondary', cols)}>
        <span>{t('dashboard.platform.table.school')}</span>
        <span>{t('dashboard.platform.table.plan')}</span>
        <span>{t('dashboard.platform.table.status')}</span>
        <span>{t('dashboard.platform.table.children')}</span>
        <span>{t('dashboard.platform.table.users')}</span>
        <span>{t('dashboard.platform.table.lastActive')}</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to={`/admin/schools/${row.id}`}
              className={cn(
                'grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 hover:bg-hover transition-colors focus-visible:outline-none focus-visible:bg-hover',
                cols,
                !row.isActive && 'opacity-60',
              )}
            >
              <div className="col-span-2 md:col-span-1 min-w-0">
                <p className="text-body font-medium text-text-heading truncate">{row.name}</p>
                <p className="text-micro text-text-secondary truncate">{row.wilaya}</p>
              </div>
              <div className="min-w-0 flex flex-col">
                {label('plan')}
                <span className="text-caption text-text-heading truncate">{row.planName ?? '—'}</span>
                {row.periodEnd && (
                  <span className="text-micro text-text-secondary">
                    {t('dashboard.platform.table.periodEnd', {
                      date: formatDateIn(row.periodEnd, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }),
                    })}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex flex-col items-start gap-1">
                {label('status')}
                <StateBadge state={row.state} />
                {row.alerts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {row.alerts
                      .filter((a) => a !== 'overdue' && a !== 'noSubscription')
                      .map((a) => (
                        <span
                          key={a}
                          className={cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro',
                            ALERT_TONE[a] === 'danger' ? 'text-danger bg-[var(--color-danger-subtle)]' : 'text-text-secondary bg-subtle',
                          )}
                        >
                          {t(`dashboard.platform.table.alerts.${a}`)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                {label('children')}
                <Usage value={row.children} max={row.maxChildren} />
              </div>
              <div className="flex flex-col">
                {label('users')}
                <Usage value={row.users} max={row.maxUsers} />
              </div>
              <div className="flex flex-col text-caption">
                {label('lastActive')}
                <LastActive row={row} today={data.today} />
              </div>
              <span className="hidden md:block">
                <ChevronIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-2">
        <div className="h-7 w-64 bg-hover rounded-md animate-pulse" />
        <div className="h-4 w-48 bg-hover rounded-md animate-pulse" />
      </div>
      <div className="h-14 bg-hover rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-hover rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-56 bg-hover rounded-lg animate-pulse" />
    </div>
  );
}

// ─── Page ───

export function PlatformDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = usePlatformDashboard();

  if (isLoading) return <DashboardSkeleton />;
  // Not loaded: nothing that looks like real figures (the page's banner says what failed).
  if (!data) return null;

  const date = formatDateIn(data.today, i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const month = formatDateIn(`${data.today.slice(0, 7)}-01`, i18n.language, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('dashboard.platform.welcome', { name: user?.firstName ?? '' })}
        </h1>
        <p className="mt-1 text-body text-text-secondary">
          <span className="first-letter:uppercase inline-block">{date}</span>
          <span> · {t('dashboard.platform.schoolCount', { count: data.schools.total })}</span>
        </p>
      </header>

      <TodoList data={data} />

      <Section title={t('dashboard.platform.sections.revenue', { month })}>
        <RevenueSection data={data} />
      </Section>

      <Section title={t('dashboard.platform.sections.schools')}>
        <SchoolsSection data={data} />
      </Section>

      <Section title={t('dashboard.platform.sections.usage')}>
        <UsageSection data={data} />
      </Section>

      <Section title={t('dashboard.platform.sections.list')}>
        <SchoolsTable data={data} />
      </Section>
    </div>
  );
}
