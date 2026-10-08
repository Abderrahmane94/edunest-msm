import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileSignature,
  FileText,
  Landmark,
  MessageCircle,
  Percent,
  School,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAdminDashboard, type AdminDashboard as Dashboard } from '@/hooks/useAdminDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIn, formatTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-subtle text-text-secondary',
  accent: 'bg-accent-muted text-primary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
};

const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-[var(--color-text-disabled)]',
  accent: 'bg-[var(--color-accent)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-text-heading',
  accent: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

// ─── Number formatting (app language, Western digits) ───

function useNumbers() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-DZ' : 'fr-DZ';
  return React.useMemo(() => {
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return {
      money: (n: number) => money.format(n),
      compact: (n: number) => compact.format(n),
      percent: (n: number) => `${number.format(n)} %`,
      number: (n: number) => number.format(n),
    };
  }, [locale]);
}

// ─── Building blocks ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-label font-semibold uppercase tracking-wide text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

function Tile({
  icon,
  tone = 'neutral',
  title,
  to,
  className,
  children,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  to?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? ChevronLeft : ChevronRight;
  const body = (
    <>
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONE_ICON[tone])}>{icon}</div>
        <p className="text-label font-medium text-text-secondary flex-1 min-w-0 truncate">{title}</p>
        {to && (
          <Chevron className="w-4 h-4 text-text-disabled shrink-0 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        )}
      </div>
      <div className="mt-3">{children}</div>
    </>
  );
  const base = 'group block bg-card border border-border rounded-xl p-4 sm:p-5';
  return to ? (
    <Link
      to={to}
      className={cn(
        base,
        'transition-[box-shadow,border-color] duration-150 hover:shadow-level-2 hover:border-[var(--color-accent-muted)] focus-visible:outline-none focus-visible:shadow-focus-ring',
        className,
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(base, className)}>{body}</div>
  );
}

function BigNumber({ value, tone = 'neutral', suffix }: { value: string; tone?: Tone; suffix?: string }) {
  return (
    <p className="flex items-baseline gap-1.5 flex-wrap">
      <span className={cn('text-page-title font-bold leading-none', TONE_TEXT[tone])} dir="ltr">
        {value}
      </span>
      {suffix && <span className="text-caption text-text-secondary">{suffix}</span>}
    </p>
  );
}

function Progress({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-2 bg-subtle rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE_FILL[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Vertical bars; a bar without a value (null) shows as an empty slot. */
function BarChart({
  bars,
  tone,
  emptyLabel,
}: {
  bars: { key: string; label: string; value: number | null; display: string }[];
  tone: Tone;
  emptyLabel: string;
}) {
  const max = Math.max(0, ...bars.map((b) => b.value ?? 0));
  return (
    <div className="flex items-end gap-2 sm:gap-3 h-40" role="list">
      {bars.map((b, i) => {
        const height = b.value != null && max > 0 ? Math.max(4, (Math.max(0, b.value) / max) * 100) : 0;
        const last = i === bars.length - 1;
        return (
          <div key={b.key} role="listitem" className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5">
            {/* On a phone only the latest value shows: the others would overlap. */}
            <span
              className={cn('text-micro font-medium whitespace-nowrap', last ? 'text-text-heading' : 'text-text-secondary hidden sm:inline')}
              dir="ltr"
            >
              {b.value != null ? b.display : ''}
            </span>
            <div className="w-full flex-1 flex items-end">
              {b.value != null ? (
                <div
                  className={cn('w-full rounded-t-md transition-[height] duration-500', TONE_FILL[tone], !last && 'opacity-50')}
                  style={{ height: `${height}%` }}
                  title={`${b.label} : ${b.display}`}
                />
              ) : (
                <div className="w-full h-1 rounded bg-subtle" title={`${b.label} : ${emptyLabel}`} />
              )}
            </div>
            <span className="text-micro text-text-secondary truncate max-w-full">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sections ───

function TodoList({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const n = useNumbers();
  const items: { key: string; tone: Tone; icon: React.ReactNode; text: string; to: string }[] = [];

  if (data.attendance.missingClassrooms.length > 0) {
    items.push({
      key: 'attendance',
      tone: 'danger',
      icon: <ClipboardList className="w-4 h-4" />,
      text: t('dashboard.admin.todo.attendance', {
        classes: data.attendance.missingClassrooms.map((c) => c.name).join(', '),
      }),
      to: '/admin/attendance',
    });
  }
  if (data.finance.late.amount > 0) {
    items.push({
      key: 'late',
      tone: 'danger',
      icon: <Clock className="w-4 h-4" />,
      text: t('dashboard.admin.todo.latePayments', {
        amount: n.money(data.finance.late.amount),
        children: data.finance.late.children,
      }),
      to: '/admin/payments?tab=late',
    });
  }
  if (data.communication.waitingParents > 0) {
    items.push({
      key: 'messages',
      tone: 'warning',
      icon: <MessageCircle className="w-4 h-4" />,
      text: t('dashboard.admin.todo.waitingParents', { count: data.communication.waitingParents }),
      to: '/admin/communication?tab=messages',
    });
  }
  if (data.communication.pendingConsents > 0) {
    items.push({
      key: 'consents',
      tone: 'warning',
      icon: <FileSignature className="w-4 h-4" />,
      text: t('dashboard.admin.todo.pendingConsents', { count: data.communication.pendingConsents }),
      to: '/admin/communication?tab=events',
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 bg-[var(--color-success-subtle)] border border-[var(--color-success-muted)] rounded-xl px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <p className="text-body font-medium text-success">{t('dashboard.admin.todo.allGood')}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h2 className="text-label font-semibold text-text-heading">{t('dashboard.admin.todo.title')}</h2>
        <span className="ms-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-danger-muted text-danger text-micro font-semibold flex items-center justify-center">
          {items.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors focus-visible:outline-none focus-visible:bg-hover"
            >
              <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', TONE_ICON[item.tone])}>
                {item.icon}
              </span>
              <span className="text-body text-text-heading flex-1 min-w-0">{item.text}</span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChevronIcon() {
  const { i18n } = useTranslation();
  const Chevron = i18n.dir() === 'rtl' ? ChevronLeft : ChevronRight;
  return <Chevron className="w-4 h-4 text-text-disabled shrink-0" />;
}

function TodaySection({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const n = useNumbers();
  const a = data.attendance;

  if (!a.isSchoolDay) {
    return (
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-4">
        <CalendarDays className="w-5 h-5 text-text-secondary" />
        <p className="text-body text-text-secondary">{t('dashboard.admin.today.noSchool')}</p>
      </div>
    );
  }

  const notMarked = Math.max(0, a.expected - a.present - a.late - a.absent);
  const total = Math.max(a.expected, a.present + a.late + a.absent, 1);
  const segments: { key: string; tone: Tone; value: number; label: string }[] = [
    { key: 'present', tone: 'success', value: a.present, label: t('dashboard.admin.today.present') },
    { key: 'late', tone: 'warning', value: a.late, label: t('dashboard.admin.today.late') },
    { key: 'absent', tone: 'danger', value: a.absent, label: t('dashboard.admin.today.absent') },
    { key: 'notMarked', tone: 'neutral', value: notMarked, label: t('dashboard.admin.today.notMarked') },
  ];
  const marked = a.classroomsToday - a.missingClassrooms.length;
  const reports = data.dailyReports;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Tile
        icon={<ClipboardCheck className="w-[18px] h-[18px]" />}
        tone="success"
        title={t('dashboard.admin.today.presence')}
        to="/admin/attendance"
      >
        <BigNumber
          value={n.number(a.present + a.late)}
          suffix={t('dashboard.admin.today.presentOf', { expected: a.expected })}
        />
        <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-subtle">
          {segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.key}
                className={cn('h-full', s.tone === 'neutral' ? 'bg-subtle' : TONE_FILL[s.tone])}
                style={{ width: `${(s.value / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-caption text-text-secondary">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  s.tone === 'neutral' ? 'bg-[var(--color-border)]' : TONE_FILL[s.tone],
                )}
              />
              <span className="truncate">{s.label}</span>
              <span className="ms-auto font-semibold text-text-heading">{s.value}</span>
            </li>
          ))}
        </ul>
      </Tile>

      <Tile
        icon={<ClipboardList className="w-[18px] h-[18px]" />}
        tone={a.missingClassrooms.length > 0 ? 'danger' : 'success'}
        title={t('dashboard.admin.today.rollCall')}
        to="/admin/attendance"
      >
        <BigNumber
          value={String(marked)}
          tone={a.missingClassrooms.length > 0 ? 'danger' : 'success'}
          suffix={t('dashboard.admin.today.classesDone', { total: a.classroomsToday })}
        />
        {a.missingClassrooms.length === 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-caption text-success">
            <CheckCircle2 className="w-4 h-4" />
            {t('dashboard.admin.today.rollCallDone')}
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {a.missingClassrooms.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-caption">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)] shrink-0" />
                <span className="font-medium text-text-heading truncate">{c.name}</span>
                {c.teacherName && <span className="text-text-secondary truncate">— {c.teacherName}</span>}
              </li>
            ))}
            {a.missingClassrooms.length > 4 && (
              <li className="text-caption text-text-secondary">+{a.missingClassrooms.length - 4}</li>
            )}
          </ul>
        )}
      </Tile>

      <Tile icon={<FileText className="w-[18px] h-[18px]" />} tone="accent" title={t('dashboard.admin.today.reports')}>
        {reports.expected > 0 ? (
          <>
            <BigNumber
              value={String(reports.sent)}
              tone={reports.sent >= reports.expected ? 'success' : 'neutral'}
              suffix={t('dashboard.admin.today.reportsOf', { expected: reports.expected })}
            />
            <div className="mt-3">
              <Progress
                value={(reports.sent / reports.expected) * 100}
                tone={reports.sent >= reports.expected ? 'success' : 'accent'}
              />
            </div>
          </>
        ) : (
          <>
            <BigNumber value={String(reports.sent)} />
            <p className="mt-3 text-caption text-text-secondary">{t('dashboard.admin.today.reportsNone')}</p>
          </>
        )}
      </Tile>
    </div>
  );
}

function FinanceSection({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const n = useNumbers();
  const f = data.finance;

  const change =
    f.collectedPreviousMonth > 0
      ? Math.round(((f.collected - f.collectedPreviousMonth) / f.collectedPreviousMonth) * 100)
      : null;
  const recoveryTone: Tone =
    f.recoveryRate == null ? 'neutral' : f.recoveryRate >= 90 ? 'success' : f.recoveryRate >= 70 ? 'warning' : 'danger';

  const bars = f.monthly.map((m) => ({
    key: m.month,
    label: formatDateIn(`${m.month}-01`, i18n.language, { month: 'short' }),
    value: m.collected,
    display: n.compact(m.collected),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile
          icon={<Wallet className="w-[18px] h-[18px]" />}
          tone="accent"
          title={t('dashboard.admin.finance.collected')}
          to="/admin/payments?tab=reconciliation"
        >
          <BigNumber value={n.money(f.collected)} />
          <p className="mt-2 text-caption text-text-secondary flex items-center gap-1">
            {change == null ? (
              t('dashboard.admin.finance.noPrevious')
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
                {t('dashboard.admin.finance.vsLastMonth')}
              </>
            )}
          </p>
        </Tile>

        <Tile
          icon={<Clock className="w-[18px] h-[18px]" />}
          tone={f.late.amount > 0 ? 'danger' : 'success'}
          title={t('dashboard.admin.finance.late')}
          to="/admin/payments?tab=late"
        >
          <BigNumber value={n.money(f.late.amount)} tone={f.late.amount > 0 ? 'danger' : 'success'} />
          <p className="mt-2 text-caption text-text-secondary">
            {f.late.amount > 0
              ? t('dashboard.admin.finance.lateChildren', { count: f.late.children })
              : t('dashboard.admin.finance.noLate')}
          </p>
        </Tile>

        <Tile
          icon={<Percent className="w-[18px] h-[18px]" />}
          tone={recoveryTone}
          title={t('dashboard.admin.finance.recovery')}
          to="/admin/payments?tab=late"
        >
          {f.recoveryRate == null ? (
            <>
              <BigNumber value="—" />
              <p className="mt-2 text-caption text-text-secondary">{t('dashboard.admin.finance.recoveryNone')}</p>
            </>
          ) : (
            <>
              <BigNumber value={n.percent(f.recoveryRate)} tone={recoveryTone} />
              <div className="mt-3">
                <Progress value={f.recoveryRate} tone={recoveryTone} />
              </div>
              <p className="mt-2 text-micro text-text-secondary">{t('dashboard.admin.finance.recoveryHint')}</p>
            </>
          )}
        </Tile>

        <Tile
          icon={<Landmark className="w-[18px] h-[18px]" />}
          tone={f.net >= 0 ? 'success' : 'danger'}
          title={t('dashboard.admin.finance.net')}
          to="/admin/payments?tab=reconciliation"
        >
          <BigNumber value={n.money(f.net)} tone={f.net >= 0 ? 'success' : 'danger'} />
          <p className="mt-2 text-caption text-text-secondary">
            {t('dashboard.admin.finance.netDetail', { expenses: n.money(f.expenses), salaries: n.money(f.salaries) })}
          </p>
        </Tile>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tile
          icon={<TrendingUp className="w-[18px] h-[18px]" />}
          tone="accent"
          title={t('dashboard.admin.finance.chart')}
          to="/admin/payments?tab=reconciliation"
        >
          <BarChart bars={bars} tone="accent" emptyLabel="—" />
        </Tile>
        <AttendanceChart data={data} />
      </div>
    </div>
  );
}

function AttendanceChart({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const n = useNumbers();
  const bars = data.attendance.weeks.map((w) => ({
    key: w.weekStart,
    label: formatDateIn(w.weekStart, i18n.language, { day: 'numeric', month: 'short' }),
    value: w.rate,
    display: w.rate != null ? n.percent(w.rate) : '',
  }));
  return (
    <Tile
      icon={<ClipboardCheck className="w-[18px] h-[18px]" />}
      tone="success"
      title={t('dashboard.admin.attendanceChart.title')}
      to="/admin/attendance"
    >
      <BarChart bars={bars} tone="success" emptyLabel={t('dashboard.admin.attendanceChart.noData')} />
      <p className="mt-2 text-micro text-text-secondary">{t('dashboard.admin.attendanceChart.hint')}</p>
    </Tile>
  );
}

function EnrollmentSection({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const e = data.enrollment;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Tile icon={<Baby className="w-[18px] h-[18px]" />} tone="accent" title={t('dashboard.admin.enrollment.active')} to="/admin/children">
        <BigNumber value={String(e.activeChildren)} />
        <p className="mt-2 text-caption text-text-secondary">
          {t('dashboard.admin.enrollment.newThisMonth', { count: e.newThisMonth })}
        </p>
      </Tile>

      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONE_ICON.accent)}>
            <School className="w-[18px] h-[18px]" />
          </div>
          <p className="text-label font-medium text-text-secondary">{t('dashboard.admin.enrollment.fill')}</p>
        </div>
        {e.classrooms.length === 0 ? (
          <p className="mt-3 text-caption text-text-secondary">{t('dashboard.admin.enrollment.noClassrooms')}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {e.classrooms.map((c) => {
              const ratio = c.capacity > 0 ? c.enrolled / c.capacity : 0;
              const tone: Tone = ratio >= 1 ? 'danger' : ratio >= 0.85 ? 'warning' : 'accent';
              return (
                <li key={c.id}>
                  <Link
                    to={`/admin/classrooms/${c.id}`}
                    className="block rounded-md -mx-1 px-1 py-0.5 hover:bg-hover transition-colors focus-visible:outline-none focus-visible:bg-hover"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-caption font-medium text-text-heading truncate">{c.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {ratio >= 1 && (
                          <span className="text-micro font-semibold text-danger">
                            {t('dashboard.admin.enrollment.full')}
                          </span>
                        )}
                        <span className="text-caption text-text-secondary" dir="ltr">
                          {c.enrolled}/{c.capacity}
                        </span>
                      </span>
                    </div>
                    <Progress value={ratio * 100} tone={tone} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CommunicationSection({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation();
  const c = data.communication;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Tile
        icon={<MessageCircle className="w-[18px] h-[18px]" />}
        tone={c.waitingParents > 0 ? 'warning' : 'success'}
        title={t('dashboard.admin.communication.waiting')}
        to="/admin/communication?tab=messages"
      >
        <BigNumber value={String(c.waitingParents)} tone={c.waitingParents > 0 ? 'warning' : 'neutral'} />
        <p className="mt-2 text-caption text-text-secondary">{t('dashboard.admin.communication.waitingHint')}</p>
      </Tile>

      <Tile
        icon={<FileSignature className="w-[18px] h-[18px]" />}
        tone={c.pendingConsents > 0 ? 'warning' : 'success'}
        title={t('dashboard.admin.communication.consents')}
        to="/admin/communication?tab=events"
      >
        <BigNumber value={String(c.pendingConsents)} tone={c.pendingConsents > 0 ? 'warning' : 'neutral'} />
        <p className="mt-2 text-caption text-text-secondary">{t('dashboard.admin.communication.consentsHint')}</p>
      </Tile>

      <div className="sm:col-span-2 lg:col-span-1 bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONE_ICON.accent)}>
            <CalendarDays className="w-[18px] h-[18px]" />
          </div>
          <p className="text-label font-medium text-text-secondary">{t('dashboard.admin.communication.events')}</p>
        </div>
        {c.upcomingEvents.length === 0 ? (
          <p className="mt-3 text-caption text-text-secondary">{t('dashboard.admin.communication.noEvents')}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {c.upcomingEvents.map((ev) => (
              <li key={ev.id}>
                <Link
                  to={`/admin/communication/events/${ev.id}`}
                  className="flex items-center gap-3 rounded-md -mx-1 px-1 py-1.5 hover:bg-hover transition-colors focus-visible:outline-none focus-visible:bg-hover"
                >
                  <span className="w-11 shrink-0 rounded-md bg-accent-muted text-primary text-center py-1">
                    <span className="block text-micro font-medium leading-tight">
                      {formatDateIn(ev.startDatetime, i18n.language, { month: 'short' })}
                    </span>
                    <span className="block text-label font-bold leading-tight">
                      {formatDateIn(ev.startDatetime, i18n.language, { day: 'numeric' })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption font-medium text-text-heading truncate">{ev.title}</span>
                    <span className="block text-micro text-text-secondary truncate">
                      {formatDateIn(ev.startDatetime, i18n.language, { weekday: 'long' })} · {formatTime(ev.startDatetime)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
      <div className="h-14 bg-hover rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-hover rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-hover rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ───

export function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) return <DashboardSkeleton />;
  // Not loaded: nothing that looks like real figures (the page's banner says what failed).
  if (!data) return null;

  const date = formatDateIn(data.today, i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const month = formatDateIn(`${data.finance.month}-01`, i18n.language, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('dashboard.admin.welcome', { name: user?.firstName ?? '' })}
        </h1>
        <p className="mt-1 text-body text-text-secondary">
          <span className="first-letter:uppercase inline-block">{date}</span>
          {data.schoolName && <span> · {data.schoolName}</span>}
        </p>
      </header>

      <TodoList data={data} />

      <Section title={t('dashboard.admin.sections.today')}>
        <TodaySection data={data} />
      </Section>

      <Section title={t('dashboard.admin.sections.finance', { month })}>
        <FinanceSection data={data} />
      </Section>

      <Section title={t('dashboard.admin.sections.enrollment')}>
        <EnrollmentSection data={data} />
      </Section>

      <Section title={t('dashboard.admin.sections.communication')}>
        <CommunicationSection data={data} />
      </Section>
    </div>
  );
}
