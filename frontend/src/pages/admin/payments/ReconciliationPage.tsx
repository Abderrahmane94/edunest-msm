import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FileBarChart, Printer, FileDown, TrendingUp, TrendingDown, Scale, CalendarRange } from 'lucide-react';
import { formatDZD } from '@/lib/formatters';
import { Button, Input } from '@/components/ui';
import { FormField } from '@/components/forms';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useReconciliation, type ReconciliationReport } from '@/hooks/useReconciliation';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getFirstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

const CHANNELS = ['cash', 'ccp', 'baridimob'] as const;

// ─── Income minus outflows ─────────────────────────────────────────────────────

function BalanceSummary({ report }: { report: ReconciliationReport }) {
  const { t, i18n } = useTranslation();
  const money = (value: string | number) => formatDZD(Number(value), i18n.language);
  const outflows = Number(report.expenses.total) + Number(report.salaries.total);
  const net = Number(report.net);

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-5">
      <h2 className="text-subsection font-semibold text-text-heading">
        {t('payments.reconciliation.balance.title')}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-subtle p-4">
          <p className="flex items-center gap-1.5 text-caption text-text-secondary">
            <TrendingUp className="w-4 h-4 text-success" />
            {t('payments.reconciliation.balance.income')}
          </p>
          <p className="mt-1 text-subsection font-semibold text-foreground" dir="ltr">
            {money(report.grandTotal)}
          </p>
        </div>
        <div className="rounded-lg bg-subtle p-4">
          <p className="flex items-center gap-1.5 text-caption text-text-secondary">
            <TrendingDown className="w-4 h-4 text-danger" />
            {t('payments.reconciliation.balance.outflows')}
          </p>
          <p className="mt-1 text-subsection font-semibold text-foreground" dir="ltr">
            {money(outflows)}
          </p>
        </div>
        <div className="rounded-lg bg-subtle p-4">
          <p className="flex items-center gap-1.5 text-caption text-text-secondary">
            <Scale className="w-4 h-4 text-primary" />
            {t('payments.reconciliation.balance.net')}
          </p>
          <p
            className={`mt-1 text-subsection font-semibold ${net < 0 ? 'text-danger' : 'text-success'}`}
            dir="ltr"
          >
            {money(net)}
          </p>
        </div>
      </div>

      {/* Outflow details */}
      {report.expenses.count === 0 && report.salaries.count === 0 ? (
        <p className="text-caption text-text-secondary">{t('payments.reconciliation.balance.noOutflows')}</p>
      ) : (
        <ul className="border border-border rounded-md divide-y divide-border">
          {report.expenses.byCategory.map((c) => (
            <li key={c.category} className="flex items-center justify-between px-4 py-2.5 text-body">
              <span className="text-foreground">
                {t('payments.reconciliation.balance.expenses')} — {t(`finance.expenses.categories.${c.category}`, c.category)}
                <span className="text-caption text-text-secondary ms-1.5">({c.count})</span>
              </span>
              <span className="text-foreground" dir="ltr">
                {money(-Number(c.total))}
              </span>
            </li>
          ))}
          {report.salaries.count > 0 && (
            <li className="flex items-center justify-between px-4 py-2.5 text-body">
              <span className="text-foreground">
                {t('payments.reconciliation.balance.salaries')}
                <span className="text-caption text-text-secondary ms-1.5">({report.salaries.count})</span>
              </span>
              <span className="text-foreground" dir="ltr">
                {money(-Number(report.salaries.total))}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Reconciliation Page ───────────────────────────────────────────────────────

export function ReconciliationPage() {
  const { t, i18n } = useTranslation();
  const { branchId: selectedBranchId } = useDefaultBranch();

  const [rangeStart, setRangeStart] = React.useState(getFirstDayOfMonth());
  const [rangeEnd, setRangeEnd] = React.useState(getTodayString());
  const [dateError, setDateError] = React.useState('');

  // "School year" shortcut: the whole active academic year.
  const { data: activeYear } = useActiveAcademicYear();
  const yearStart = activeYear?.start_date?.slice(0, 10);
  const yearEnd = activeYear?.end_date?.slice(0, 10);
  const isWholeYear = !!yearStart && rangeStart === yearStart && rangeEnd === yearEnd;

  // Validate date range
  React.useEffect(() => {
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      setDateError(t('payments.reconciliation.errors.invalidRange'));
    } else {
      setDateError('');
    }
  }, [rangeStart, rangeEnd, t]);

  const isQueryEnabled = !!selectedBranchId && !!rangeStart && !!rangeEnd && !dateError;

  const { data: report, isLoading, isError } = useReconciliation(
    selectedBranchId,
    isQueryEnabled ? rangeStart : '',
    isQueryEnabled ? rangeEnd : ''
  );

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    if (!report) return;

    const rows = [
      [
        t('payments.reconciliation.columns.channel'),
        t('payments.reconciliation.columns.totalAmount'),
        t('payments.reconciliation.columns.paymentCount'),
        t('payments.reconciliation.columns.correctionCount'),
      ],
      ...CHANNELS.map((ch) => [
        t(`payments.reconciliation.channels.${ch}`),
        report.channels[ch].total,
        String(report.channels[ch].paymentCount),
        String(report.channels[ch].correctionCount),
      ]),
      [
        t('payments.reconciliation.grandTotal'),
        report.grandTotal,
        String(
          CHANNELS.reduce((sum, ch) => sum + report.channels[ch].paymentCount, 0)
        ),
        String(
          CHANNELS.reduce((sum, ch) => sum + report.channels[ch].correctionCount, 0)
        ),
      ],
    ];

    // Income minus outflows, after the per-channel table.
    rows.push(
      [],
      [t('payments.reconciliation.balance.title')],
      [t('payments.reconciliation.balance.income'), report.grandTotal],
      ...report.expenses.byCategory.map((c) => [
        `${t('payments.reconciliation.balance.expenses')} — ${t(`finance.expenses.categories.${c.category}`, c.category)}`,
        `-${c.total}`,
        String(c.count),
      ]),
      [t('payments.reconciliation.balance.salaries'), `-${report.salaries.total}`, String(report.salaries.count)],
      [t('payments.reconciliation.balance.net'), report.net],
    );

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliation-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const hasData = report && (
    Number(report.channels.cash.paymentCount) > 0 ||
    Number(report.channels.ccp.paymentCount) > 0 ||
    Number(report.channels.baridimob.paymentCount) > 0 ||
    Number(report.channels.cash.correctionCount) > 0 ||
    Number(report.channels.ccp.correctionCount) > 0 ||
    Number(report.channels.baridimob.correctionCount) > 0
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between print:justify-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileBarChart className="w-5 h-5 text-primary print:hidden" />
          <h2 className="text-section font-semibold text-text-heading">
            {t('payments.reconciliation.title')}
          </h2>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={!report || !hasData}
          >
            <FileDown className="w-4 h-4" />
            {t('payments.reconciliation.export')}
          </Button>
          <Button
            variant="secondary"
            onClick={handlePrint}
            disabled={!report}
          >
            <Printer className="w-4 h-4" />
            {t('payments.reconciliation.print')}
          </Button>
        </div>
      </div>

      <p className="text-body text-text-secondary print:hidden">
        {t('payments.reconciliation.description')}
      </p>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3 print:border-0 print:p-0">
        {yearStart && yearEnd && (
          <div className="print:hidden">
            <Button
              type="button"
              variant={isWholeYear ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setRangeStart(yearStart);
                setRangeEnd(yearEnd);
              }}
            >
              <CalendarRange className="w-4 h-4" />
              {t('payments.reconciliation.schoolYear', { name: activeYear?.name ?? '' })}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Start date */}
          <FormField
            label={t('payments.reconciliation.fields.rangeStart')}
            htmlFor="reconciliation-range-start"
            error={dateError}
            required
          >
            <Input
              id="reconciliation-range-start"
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </FormField>

          {/* End date */}
          <FormField
            label={t('payments.reconciliation.fields.rangeEnd')}
            htmlFor="reconciliation-range-end"
            required
          >
            <Input
              id="reconciliation-range-end"
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {/* Report Table */}
      {isLoading && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-card border border-danger/30 rounded-lg p-6 text-center">
          <p className="text-body text-danger">
            {t('payments.reconciliation.errors.fetchFailed')}
          </p>
        </div>
      )}

      {!isLoading && !isError && report && !hasData && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <FileBarChart className="w-10 h-10 text-text-secondary mx-auto mb-3 opacity-50" />
          <p className="text-body text-text-secondary">
            {t('payments.reconciliation.empty')}
          </p>
        </div>
      )}

      {!isLoading && !isError && report && hasData && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-border bg-subtle">
                  <th
                    className="text-start px-4 py-3 text-label font-medium text-text-secondary"
                    scope="col"
                  >
                    {t('payments.reconciliation.columns.channel')}
                  </th>
                  <th
                    className="text-start px-4 py-3 text-label font-medium text-text-secondary"
                    scope="col"
                  >
                    {t('payments.reconciliation.columns.totalAmount')}
                  </th>
                  <th
                    className="text-start px-4 py-3 text-label font-medium text-text-secondary"
                    scope="col"
                  >
                    {t('payments.reconciliation.columns.paymentCount')}
                  </th>
                  <th
                    className="text-start px-4 py-3 text-label font-medium text-text-secondary"
                    scope="col"
                  >
                    {t('payments.reconciliation.columns.correctionCount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((channel) => {
                  const summary = report.channels[channel];
                  return (
                    <tr
                      key={channel}
                      className="border-b border-border hover:bg-hover transition-colors"
                    >
                      <td className="px-4 py-3 text-body font-medium text-foreground">
                        {t(`payments.reconciliation.channels.${channel}`)}
                      </td>
                      <td className="px-4 py-3 text-body text-foreground" dir="ltr">
                        {formatDZD(Number(summary.total), i18n.language)}
                      </td>
                      <td className="px-4 py-3 text-body text-foreground">
                        {summary.paymentCount}
                      </td>
                      <td className="px-4 py-3 text-body text-foreground">
                        {summary.correctionCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-subtle border-t-2 border-border">
                  <td className="px-4 py-3 text-body font-semibold text-text-heading">
                    {t('payments.reconciliation.grandTotal')}
                  </td>
                  <td
                    className="px-4 py-3 text-body font-semibold text-text-heading"
                    dir="ltr"
                  >
                    {formatDZD(Number(report.grandTotal), i18n.language)}
                  </td>
                  <td className="px-4 py-3 text-body font-semibold text-text-heading">
                    {CHANNELS.reduce(
                      (sum, ch) => sum + report.channels[ch].paymentCount,
                      0
                    )}
                  </td>
                  <td className="px-4 py-3 text-body font-semibold text-text-heading">
                    {CHANNELS.reduce(
                      (sum, ch) => sum + report.channels[ch].correctionCount,
                      0
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Income minus outflows */}
      {!isLoading && !isError && report && <BalanceSummary report={report} />}

      {/* Print-only date range display */}
      {report && hasData && (
        <div className="hidden print:block text-center mt-4">
          <p className="text-caption text-text-secondary">
            {t('payments.reconciliation.printRange', {
              start: rangeStart,
              end: rangeEnd,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
