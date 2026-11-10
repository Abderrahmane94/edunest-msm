import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Baby, CalendarCheck, Download, Printer, Users, Wallet, AlertTriangle, UserCheck, TrendingUp, Receipt, UserPlus } from 'lucide-react';
import { Button, DataTable, ErrorAlert, KPICard, ListSkeleton, PageHeader, StatusBadge } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { Input } from '@/components/ui';
import { errorMessage } from '@/lib/errorMessage';
import { formatDateIn, formatDZD, formatMonthYear } from '@/lib/formatters';
import { downloadXlsx, type Cell, type CellValue, type Sheet } from '@/lib/xlsx';
import { BarChart, Tile } from '@/pages/admin/dashboard/parts';
import { useNumbers } from '@/pages/admin/dashboard/theme';
import {
  useAssociationOverview,
  useAssociationTrend,
  type AssociationOverview,
  type AssociationTrend,
  type ClubFigures,
  type MonthPoint,
} from '@/hooks/useAssociations';

/** This month, YYYY-MM, in the school's time zone (as the server counts it). */
function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit' }).format(new Date());
}

const percent = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value} %`);

/** Present (or late) over expected, as a percentage; a dash when nobody is expected. */
function todayRate(today: ClubFigures['attendance']['today']): string {
  if (!today.expected) return '—';
  return `${Math.round(((today.present + today.late) / today.expected) * 100)} %`;
}

/**
 * The association's page: each club's figures side by side, and the total.
 * Numbers only, read-only: the clubs run themselves.
 */
export function AssociationDashboardPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'fr';
  const thisMonth = React.useMemo(currentMonth, []);
  const [month, setMonth] = React.useState(thisMonth);
  const { data, isLoading, isError, error } = useAssociationOverview(month);
  const { data: trend } = useAssociationTrend(month);
  const money = (n: number) => formatDZD(n, lang);
  const monthLabel = formatMonthYear(`${month}-01`, lang);

  const columns: Column<ClubFigures>[] = [
    {
      key: 'name',
      header: t('associationDashboard.columns.club'),
      mobile: 'title',
      render: (c) => (
        <span className="block">
          <span className="block text-body font-medium text-foreground" dir="auto">{c.name}</span>
          <span className="flex items-center gap-2 text-caption text-text-secondary">
            {c.wilaya}
            {!c.isOpen && <StatusBadge variant="danger">{t('associationDashboard.closed')}</StatusBadge>}
          </span>
        </span>
      ),
    },
    {
      key: 'children',
      header: t('associationDashboard.columns.children'),
      render: (c) => (
        <span className="tabular-nums">
          {c.children.active}
          {c.children.newInMonth > 0 && <span className="text-caption text-success"> +{c.children.newInMonth}</span>}
        </span>
      ),
    },
    {
      key: 'staff',
      header: t('associationDashboard.columns.staff'),
      render: (c) => (
        <span className="tabular-nums" title={t('associationDashboard.staffDetail', c.staff)}>
          {c.staff.total} <span className="text-caption text-text-secondary">({t('associationDashboard.teachersShort', { count: c.staff.teachers })})</span>
        </span>
      ),
    },
    {
      key: 'classrooms',
      header: t('associationDashboard.columns.classrooms'),
      render: (c) => (
        <span className="tabular-nums">
          {c.classrooms.count}{' '}
          <span className="text-caption text-text-secondary" dir="ltr">({c.classrooms.enrolled}/{c.classrooms.capacity})</span>
        </span>
      ),
    },
    {
      key: 'today',
      header: t('associationDashboard.columns.today'),
      render: (c) =>
        c.attendance.today.isSchoolDay ? (
          <span className="tabular-nums" dir="ltr">
            {c.attendance.today.present + c.attendance.today.late}/{c.attendance.today.expected}
          </span>
        ) : (
          <span className="text-caption text-text-secondary">{t('associationDashboard.dayOff')}</span>
        ),
    },
    {
      key: 'month',
      header: t('associationDashboard.columns.monthAttendance'),
      render: (c) => <span className="tabular-nums">{percent(c.attendance.month.rate)}</span>,
    },
    {
      key: 'collected',
      header: t('associationDashboard.columns.collected'),
      render: (c) => <span className="tabular-nums">{money(c.finance.collected)}</span>,
    },
    {
      key: 'spent',
      header: t('associationDashboard.columns.spent'),
      render: (c) => <span className="tabular-nums">{money(c.finance.expenses + c.finance.salaries)}</span>,
    },
    {
      key: 'net',
      header: t('associationDashboard.columns.net'),
      render: (c) => <span className={`tabular-nums ${c.finance.net < 0 ? 'text-danger' : ''}`}>{money(c.finance.net)}</span>,
    },
    {
      key: 'late',
      header: t('associationDashboard.columns.late'),
      render: (c) => (
        <span className="tabular-nums">
          {money(c.finance.late.amount)}
          {c.finance.late.children > 0 && (
            <span className="block text-caption text-text-secondary">{t('associationDashboard.lateChildren', { count: c.finance.late.children })}</span>
          )}
        </span>
      ),
    },
    {
      key: 'recovery',
      header: t('associationDashboard.columns.recovery'),
      render: (c) => <span className="tabular-nums">{percent(c.finance.recoveryRate)}</span>,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={data?.association.name ?? t('associationDashboard.title')}
        description={t('associationDashboard.description', { count: data?.clubs.length ?? 0 })}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="secondary" disabled={!data} onClick={() => data && downloadWorkbook(data, trend, t, monthLabel, lang)}>
              <Download className="w-4 h-4" />
              {t('associationDashboard.export')}
            </Button>
            <Button variant="secondary" disabled={!data} onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              {t('associationDashboard.print')}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="w-48">
          <FormField label={t('associationDashboard.month')} htmlFor="association-month">
            <Input
              id="association-month"
              type="month"
              value={month}
              max={thisMonth}
              onChange={(e) => e.target.value && e.target.value <= thisMonth && setMonth(e.target.value)}
            />
          </FormField>
        </div>
        <p className="text-caption text-text-secondary pb-5">{t('associationDashboard.monthHint')}</p>
      </div>

      {isError && <ErrorAlert message={errorMessage(error, t)} />}

      {isLoading || !data ? (
        !isError && <ListSkeleton />
      ) : data.clubs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6 text-body text-text-secondary">{t('associationDashboard.noClubs')}</div>
      ) : (
        <>
          <Totals data={data} monthLabel={monthLabel} money={money} />
          <section className="space-y-2">
            <h2 className="text-subsection font-semibold text-text-heading">{t('associationDashboard.byClub')}</h2>
            <DataTable<ClubFigures> columns={columns} data={data.clubs} keyExtractor={(c) => c.id} />
            <p className="text-caption text-text-secondary">{t('associationDashboard.footnote')}</p>
          </section>
          {trend && <Evolution trend={trend} />}
        </>
      )}
    </div>
  );
}

function Totals({ data, monthLabel, money }: { data: AssociationOverview; monthLabel: string; money: (n: number) => string }) {
  const { t } = useTranslation();
  const { totals } = data;
  return (
    <section className="space-y-3">
      <h2 className="text-subsection font-semibold text-text-heading">{t('associationDashboard.totals', { count: totals.clubs })}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label={t('associationDashboard.kpi.children')}
          value={totals.children.active}
          icon={<Baby className="w-5 h-5" />}
          trend={totals.children.newInMonth > 0 ? { direction: 'up', value: t('associationDashboard.kpi.newInMonth', { count: totals.children.newInMonth }) } : undefined}
        />
        <KPICard
          label={t('associationDashboard.kpi.staff')}
          value={totals.staff.total}
          icon={<Users className="w-5 h-5" />}
          trend={{ direction: 'up', value: t('associationDashboard.teachersShort', { count: totals.staff.teachers }) }}
        />
        <KPICard
          label={t('associationDashboard.kpi.today')}
          value={totals.attendance.today.isSchoolDay ? todayRate(totals.attendance.today) : t('associationDashboard.dayOff')}
          icon={<UserCheck className="w-5 h-5" />}
        />
        <KPICard
          label={t('associationDashboard.kpi.monthAttendance', { month: monthLabel })}
          value={percent(totals.attendance.month.rate)}
          icon={<CalendarCheck className="w-5 h-5" />}
        />
        <KPICard label={t('associationDashboard.kpi.collected', { month: monthLabel })} value={money(totals.finance.collected)} icon={<Wallet className="w-5 h-5" />} />
        <KPICard
          label={t('associationDashboard.kpi.spent', { month: monthLabel })}
          value={money(totals.finance.expenses + totals.finance.salaries)}
          icon={<Wallet className="w-5 h-5" />}
        />
        <KPICard label={t('associationDashboard.kpi.net', { month: monthLabel })} value={money(totals.finance.net)} icon={<Wallet className="w-5 h-5" />} />
        <KPICard
          label={t('associationDashboard.kpi.late')}
          value={money(totals.finance.late.amount)}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={totals.finance.late.children > 0 ? { direction: 'down', value: t('associationDashboard.lateChildren', { count: totals.finance.late.children }) } : undefined}
        />
      </div>
    </section>
  );
}

/** The twelve months up to the chosen one, for the association or one of its clubs. */
function Evolution({ trend }: { trend: AssociationTrend }) {
  const { t, i18n } = useTranslation();
  const n = useNumbers();
  const [clubId, setClubId] = React.useState('');
  const points = (clubId && trend.clubs.find((c) => c.id === clubId)?.points) || trend.totals;
  const bars = (value: (p: MonthPoint) => number | null, display: (v: number) => string) =>
    points.map((p) => {
      const v = value(p);
      return { key: p.month, label: formatDateIn(`${p.month}-01`, i18n.language, { month: 'short' }), value: v, display: v === null ? '' : display(v) };
    });
  const empty = t('associationDashboard.evolution.empty');

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-subsection font-semibold text-text-heading">{t('associationDashboard.evolution.title')}</h2>
          <p className="text-caption text-text-secondary">{t('associationDashboard.evolution.hint')}</p>
        </div>
        <div className="w-64 print:hidden">
          <FormSelect
            label={t('associationDashboard.evolution.for')}
            name="evolution-club"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            options={[{ value: '', label: t('associationDashboard.evolution.all') }, ...trend.clubs.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tile icon={<Wallet className="w-[18px] h-[18px]" />} tone="accent" title={t('associationDashboard.evolution.collected')}>
          <BarChart bars={bars((p) => p.collected, n.compact)} tone="accent" emptyLabel={empty} />
        </Tile>
        <Tile icon={<Receipt className="w-[18px] h-[18px]" />} tone="warning" title={t('associationDashboard.evolution.spent')}>
          <BarChart bars={bars((p) => p.expenses + p.salaries, n.compact)} tone="warning" emptyLabel={empty} />
        </Tile>
        <Tile icon={<TrendingUp className="w-[18px] h-[18px]" />} tone="success" title={t('associationDashboard.evolution.attendance')}>
          <BarChart bars={bars((p) => p.rate, n.percent)} tone="success" emptyLabel={empty} />
        </Tile>
        <Tile icon={<UserPlus className="w-[18px] h-[18px]" />} tone="accent" title={t('associationDashboard.evolution.newChildren')}>
          <BarChart bars={bars((p) => p.newChildren, n.number)} tone="accent" emptyLabel={empty} />
        </Tile>
      </div>
    </section>
  );
}

type Translate = (key: string, o?: Record<string, unknown>) => string;
type Figures = Omit<ClubFigures, 'id' | 'name' | 'wilaya' | 'isOpen'>;

/**
 * The figures as an Excel workbook: the month's figures club by club with the
 * total, then the twelve months' evolution (in total, and club by club).
 */
function downloadWorkbook(data: AssociationOverview, trend: AssociationTrend | undefined, t: Translate, monthLabel: string, lang: 'fr' | 'ar') {
  const head = (labels: string[]): Cell[] => labels.map((value) => ({ value, style: 'header' }));
  const money = (value: number, total = false): Cell => ({ value, style: total ? 'totalMoney' : 'money' });
  const pct = (value: number | null | undefined, total = false): Cell => ({ value: value ?? null, style: total ? 'totalPercent' : 'percent' });
  const num = (value: number, total = false): Cell => ({ value, style: total ? 'total' : 'plain' });
  const monthName = (m: string) => formatMonthYear(`${m}-01`, lang);

  const summaryLine = (name: string, wilaya: string, c: Figures, total = false): Cell[] => [
    { value: name, style: total ? 'total' : 'plain' },
    { value: wilaya, style: total ? 'total' : 'plain' },
    num(c.children.active, total),
    num(c.children.newInMonth, total),
    num(c.staff.teachers, total),
    num(c.staff.office, total),
    num(c.staff.other, total),
    num(c.classrooms.count, total),
    num(c.classrooms.capacity, total),
    num(c.classrooms.enrolled, total),
    num(c.attendance.today.present + c.attendance.today.late, total),
    num(c.attendance.today.expected, total),
    pct(c.attendance.month.rate, total),
    money(c.finance.collected, total),
    money(c.finance.expenses, total),
    money(c.finance.salaries, total),
    money(c.finance.net, total),
    money(c.finance.late.amount, total),
    num(c.finance.late.children, total),
    pct(c.finance.recoveryRate, total),
  ];

  const sheets: Sheet[] = [
    {
      name: t('associationDashboard.xlsx.summary'),
      rtl: lang === 'ar',
      frozenRows: 3,
      widths: [28, 14, ...Array<number>(18).fill(14)],
      rows: [
        [{ value: `${data.association.name} — ${monthLabel}`, style: 'title' }],
        [t('associationDashboard.xlsx.asOf', { date: formatDateIn(data.today, lang, { day: 'numeric', month: 'long', year: 'numeric' }) })],
        head([
          t('associationDashboard.columns.club'),
          t('associationDashboard.csv.wilaya'),
          t('associationDashboard.columns.children'),
          t('associationDashboard.csv.newInMonth'),
          t('associationDashboard.csv.teachers'),
          t('associationDashboard.csv.office'),
          t('associationDashboard.csv.otherStaff'),
          t('associationDashboard.columns.classrooms'),
          t('associationDashboard.csv.capacity'),
          t('associationDashboard.csv.enrolled'),
          t('associationDashboard.csv.presentToday'),
          t('associationDashboard.csv.expectedToday'),
          t('associationDashboard.columns.monthAttendance'),
          t('associationDashboard.columns.collected'),
          t('associationDashboard.csv.expenses'),
          t('associationDashboard.csv.salaries'),
          t('associationDashboard.columns.net'),
          t('associationDashboard.columns.late'),
          t('associationDashboard.csv.lateChildren'),
          t('associationDashboard.columns.recovery'),
        ]),
        ...data.clubs.map((c) => summaryLine(c.name, c.wilaya, c)),
        summaryLine(t('associationDashboard.csv.total'), '', data.totals, true),
      ],
    },
  ];

  if (trend) {
    const monthHead = t('associationDashboard.xlsx.month');
    // Month by month, a column per club and the total last.
    const byClub = (pick: (p: MonthPoint) => number | null, cell: (v: number | null, total: boolean) => Cell): (Cell | CellValue)[][] => [
      head([monthHead, ...trend.clubs.map((c) => c.name), t('associationDashboard.csv.total')]),
      ...trend.months.map((m, i) => [monthName(m), ...trend.clubs.map((c) => cell(pick(c.points[i]), false)), cell(pick(trend.totals[i]), true)]),
    ];
    sheets.push({
      name: t('associationDashboard.xlsx.evolution'),
      rtl: lang === 'ar',
      widths: [18, ...Array<number>(Math.max(6, trend.clubs.length + 1)).fill(16)],
      rows: [
        [{ value: `${data.association.name} — ${t('associationDashboard.evolution.title')}`, style: 'title' }],
        [],
        head([
          monthHead,
          t('associationDashboard.columns.collected'),
          t('associationDashboard.csv.expenses'),
          t('associationDashboard.csv.salaries'),
          t('associationDashboard.columns.net'),
          t('associationDashboard.evolution.newChildren'),
          t('associationDashboard.evolution.attendance'),
        ]),
        ...trend.totals.map((p) => [monthName(p.month), money(p.collected), money(p.expenses), money(p.salaries), money(p.net), p.newChildren, pct(p.rate)]),
        [],
        [{ value: t('associationDashboard.xlsx.collectedByClub'), style: 'title' }],
        ...byClub((p) => p.collected, (v, total) => money(v ?? 0, total)),
        [],
        [{ value: t('associationDashboard.xlsx.attendanceByClub'), style: 'title' }],
        ...byClub((p) => p.rate, (v, total) => pct(v, total)),
      ],
    });
  }

  const safeName = data.association.name.replace(/[^\p{L}\p{N}]+/gu, '-');
  downloadXlsx(`kiddoo-${safeName}-${data.month}.xlsx`, sheets);
}
