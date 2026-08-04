import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import { DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import { useBranches } from '@/hooks/useEnrollments';
import {
  useLateDashboard,
  type LateDashboardEntry,
  type LatePeriodStatus,
} from '@/hooks/useLateDashboard';

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: LatePeriodStatus; label: string }) {
  const styles: Record<LatePeriodStatus, string> = {
    late: 'bg-danger/10 text-danger',
    late_partial: 'bg-warning/10 text-warning',
  };

  return (
    <span className={`text-caption px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {label}
    </span>
  );
}

// ─── Late Dashboard Page ───────────────────────────────────────────────────────

export function LateDashboardPage() {
  const { t, i18n } = useTranslation();
  const { data: branches } = useBranches();
  const [selectedBranchId, setSelectedBranchId] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<LatePeriodStatus | ''>('');

  // Auto-select first branch
  React.useEffect(() => {
    if (!selectedBranchId && branches && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const { data: entries, isLoading } = useLateDashboard(selectedBranchId, statusFilter);

  const branchOptions = (branches ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const statusOptions = [
    { value: '', label: t('payments.late.filterAll') },
    { value: 'late', label: t('payments.late.statusLate') },
    { value: 'late_partial', label: t('payments.late.statusLatePartial') },
  ];

  const columns: Column<LateDashboardEntry>[] = [
    {
      key: 'childName',
      header: t('payments.late.columns.childName'),
      render: (entry) => (
        <span className="text-body font-medium text-foreground">
          {entry.childName}
        </span>
      ),
    },
    {
      key: 'periodLabel',
      header: t('payments.late.columns.periodLabel'),
      render: (entry) => (
        <span className="text-body text-foreground">
          {entry.periodLabel}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: t('payments.late.columns.dueDate'),
      render: (entry) => (
        <span className="text-body text-text-secondary" dir="ltr">
          {formatDate(entry.dueDate)}
        </span>
      ),
    },
    {
      key: 'graceEndDate',
      header: t('payments.late.columns.graceEndDate'),
      render: (entry) => (
        <span className="text-body text-text-secondary" dir="ltr">
          {formatDate(entry.graceEndDate)}
        </span>
      ),
    },
    {
      key: 'amountDue',
      header: t('payments.late.columns.amountDue'),
      render: (entry) => (
        <span className="text-body text-foreground" dir="ltr">
          {formatDZD(Number(entry.amountDue), i18n.language)}
        </span>
      ),
    },
    {
      key: 'totalPaid',
      header: t('payments.late.columns.totalPaid'),
      render: (entry) => (
        <span className="text-body text-foreground" dir="ltr">
          {formatDZD(Number(entry.totalPaid), i18n.language)}
        </span>
      ),
    },
    {
      key: 'outstanding',
      header: t('payments.late.columns.outstanding'),
      render: (entry) => (
        <span className="text-body font-medium text-danger" dir="ltr">
          {formatDZD(Number(entry.outstanding), i18n.language)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('payments.late.columns.status'),
      render: (entry) => (
        <StatusBadge
          status={entry.status}
          label={
            entry.status === 'late'
              ? t('payments.late.statusLate')
              : t('payments.late.statusLatePartial')
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-danger" />
        <h1 className="text-page-title font-semibold text-text-heading">
          {t('payments.late.title')}
        </h1>
      </div>

      <p className="text-body text-text-secondary">
        {t('payments.late.description')}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        {branchOptions.length > 1 && (
          <div className="w-full max-w-xs">
            <FormSelect
              label={t('payments.late.filterBranch')}
              name="branchFilter"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              options={branchOptions}
              placeholder={t('payments.late.selectBranch')}
            />
          </div>
        )}
        <div className="w-full max-w-xs">
          <FormSelect
            label={t('payments.late.filterStatus')}
            name="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LatePeriodStatus | '')}
            options={statusOptions}
          />
        </div>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      ) : (entries ?? []).length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-text-disabled mx-auto mb-3" />
          <p className="text-body text-text-secondary">
            {t('payments.late.empty')}
          </p>
        </div>
      ) : (
        <DataTable<LateDashboardEntry>
          columns={columns}
          data={entries ?? []}
          keyExtractor={(entry) => entry.id}
          emptyMessage={t('payments.late.empty')}
        />
      )}
    </div>
  );
}
