import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FileBarChart, Printer, FileDown } from 'lucide-react';
import { formatDZD } from '@/lib/formatters';
import { Button, Input } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import { useReconciliation } from '@/hooks/useReconciliation';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getFirstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

const CHANNELS = ['cash', 'ccp', 'baridimob'] as const;

// ─── Reconciliation Page ───────────────────────────────────────────────────────

export function ReconciliationPage() {
  const { t, i18n } = useTranslation();
  const { branchId: selectedBranchId } = useDefaultBranch();

  const [rangeStart, setRangeStart] = React.useState(getFirstDayOfMonth());
  const [rangeEnd, setRangeEnd] = React.useState(getTodayString());
  const [dateError, setDateError] = React.useState('');

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
      <div className="flex items-center justify-between print:justify-center">
        <div className="flex items-center gap-3">
          <FileBarChart className="w-6 h-6 text-primary print:hidden" />
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('payments.reconciliation.title')}
          </h1>
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
      <div className="bg-card border border-border rounded-lg p-4 print:border-0 print:p-0">
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
