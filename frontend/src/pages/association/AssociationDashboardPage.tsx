import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Baby, CalendarCheck, Download, Printer, Users, Wallet, AlertTriangle, UserCheck } from 'lucide-react';
import { Button, DataTable, ErrorAlert, KPICard, ListSkeleton, PageHeader, StatusBadge } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField } from '@/components/forms';
import { Input } from '@/components/ui';
import { errorMessage } from '@/lib/errorMessage';
import { formatDZD, formatMonthYear } from '@/lib/formatters';
import { useAssociationOverview, type AssociationOverview, type ClubFigures } from '@/hooks/useAssociations';

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
            <Button variant="secondary" disabled={!data} onClick={() => data && downloadCsv(data, t, monthLabel)}>
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

/** The figures as a spreadsheet (CSV, read by Excel): one line per club, then the total. */
function downloadCsv(data: AssociationOverview, t: (key: string, o?: Record<string, unknown>) => string, monthLabel: string) {
  const header = [
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
  ];
  const line = (name: string, wilaya: string, c: Omit<ClubFigures, 'id' | 'name' | 'wilaya' | 'isOpen'>) => [
    name,
    wilaya,
    c.children.active,
    c.children.newInMonth,
    c.staff.teachers,
    c.staff.office,
    c.staff.other,
    c.classrooms.count,
    c.classrooms.capacity,
    c.classrooms.enrolled,
    c.attendance.today.present + c.attendance.today.late,
    c.attendance.today.expected,
    c.attendance.month.rate ?? '',
    c.finance.collected,
    c.finance.expenses,
    c.finance.salaries,
    c.finance.net,
    c.finance.late.amount,
    c.finance.late.children,
    c.finance.recoveryRate ?? '',
  ];
  const rows = [
    [`${data.association.name} — ${monthLabel}`],
    header,
    ...data.clubs.map((c) => line(c.name, c.wilaya, c)),
    line(t('associationDashboard.csv.total'), '', data.totals),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kiddoo-${data.association.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${data.month}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
