import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, BellRing, Wallet } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import { Button, DataTable, FilterBar, FilterChips, SectionHeader, StatusBadge } from '@/components/ui';
import { usePermissions } from '@/lib/roles';
import type { Column } from '@/components/ui';
import { FormSelect } from '@/components/forms';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import {
  useLateDashboard,
  type LateDashboardEntry,
  type LatePeriodStatus,
} from '@/hooks/useLateDashboard';
import { LateReminderDialog } from './LateReminderDialog';
import { ChildAccountDialog } from './ChildAccountDialog';

// ─── Status Badge ──────────────────────────────────────────────────────────────

function LateBadge({ status, label }: { status: LatePeriodStatus; label: string }) {
  return <StatusBadge variant={status === 'late' ? 'danger' : 'warning'}>{label}</StatusBadge>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const REGISTRATION_FEE = '__registration__';
const MIN_DAYS_OPTIONS = ['7', '30', '60'];

/** Whole days since the grace period ended (how late the period is). */
function daysLate(graceEndDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const graceEnd = new Date(graceEndDate);
  graceEnd.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - graceEnd.getTime()) / 86_400_000));
}

// ─── Late Dashboard Page ───────────────────────────────────────────────────────

export function LateDashboardPage() {
  const { t, i18n } = useTranslation();
  const { branchId: selectedBranchId } = useDefaultBranch();
  const [statusFilter, setStatusFilter] = React.useState<LatePeriodStatus | ''>('');

  // The whole late list is loaded: the status chips count it and filter it here.
  const { data: allEntries, isLoading } = useLateDashboard(selectedBranchId);
  const navigate = useNavigate();
  const canCollect = usePermissions().can('collections', 'edit');

  // ─── Filters (the late list is small and loaded whole, so filter here) ───
  const [search, setSearch] = React.useState('');
  const [classroomFilter, setClassroomFilter] = React.useState('');
  const [feeFilter, setFeeFilter] = React.useState('');
  const [minDays, setMinDays] = React.useState('');

  // ─── Row actions ───
  const [remindEntry, setRemindEntry] = React.useState<LateDashboardEntry | null>(null);
  const [accountChild, setAccountChild] = React.useState<{ id: string; name: string } | null>(null);

  const feeLabel = (entry: LateDashboardEntry) =>
    entry.isRegistrationPeriod ? t('payments.late.registrationFee') : (entry.feeName ?? '—');

  /** "Reminded today" / "Reminded 3 days ago". */
  function remindedLabel(lastReminderAt: string): string {
    const days = daysLate(lastReminderAt);
    return days === 0
      ? t('payments.late.reminder.remindedToday')
      : t('payments.late.reminder.remindedDaysAgo', { count: days });
  }

  const classroomOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const e of allEntries ?? []) for (const c of e.classrooms) byId.set(c.id, c.name);
    return [...byId].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [allEntries]);

  const feeOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const e of allEntries ?? []) {
      if (e.isRegistrationPeriod) byId.set(REGISTRATION_FEE, t('payments.late.registrationFee'));
      else if (e.feeId) byId.set(e.feeId, e.feeName ?? '');
    }
    return [...byId].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [allEntries, t]);

  // Everything but the status: what the status chips count.
  const matching = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (allEntries ?? []).filter((e) => {
      if (needle && !e.childName.toLowerCase().includes(needle)) return false;
      if (classroomFilter && !e.classrooms.some((c) => c.id === classroomFilter)) return false;
      if (feeFilter === REGISTRATION_FEE && !e.isRegistrationPeriod) return false;
      if (feeFilter && feeFilter !== REGISTRATION_FEE && e.feeId !== feeFilter) return false;
      if (minDays && daysLate(e.graceEndDate) < Number(minDays)) return false;
      return true;
    });
  }, [allEntries, search, classroomFilter, feeFilter, minDays]);
  const entries = React.useMemo(() => (statusFilter ? matching.filter((e) => e.status === statusFilter) : matching), [matching, statusFilter]);

  const hasFilters = !!(search || classroomFilter || feeFilter || minDays || statusFilter);
  const totalOutstanding = entries.reduce((sum, e) => sum + Number(e.outstanding), 0);
  const childCount = new Set(entries.map((e) => e.childId || e.childName)).size;

  function resetFilters() {
    setSearch('');
    setClassroomFilter('');
    setFeeFilter('');
    setMinDays('');
    setStatusFilter('');
  }

  const statusOptions: { value: LatePeriodStatus | ''; label: string; count: number; dot?: string }[] = [
    { value: '', label: t('payments.late.filterAll'), count: matching.length },
    { value: 'late', label: t('payments.late.statusLate'), count: matching.filter((e) => e.status === 'late').length, dot: 'bg-danger' },
    { value: 'late_partial', label: t('payments.late.statusLatePartial'), count: matching.filter((e) => e.status === 'late_partial').length, dot: 'bg-warning' },
  ];

  const columns: Column<LateDashboardEntry>[] = [
    {
      key: 'childName',
      header: t('payments.late.columns.childName'),
      render: (entry) => (
        <div>
          <span className="text-body font-medium text-foreground">{entry.childName}</span>
          {entry.classrooms.length > 0 && (
            <p className="text-caption text-text-secondary">
              {entry.classrooms.map((c) => c.name).join(', ')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'fee',
      header: t('payments.late.columns.fee'),
      render: (entry) => (
        <div>
          <span className="text-body text-foreground">{feeLabel(entry)}</span>
          <p className="text-caption text-text-secondary">{entry.periodLabel}</p>
        </div>
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
        <div>
          <span className="text-body text-text-secondary" dir="ltr">
            {formatDate(entry.graceEndDate)}
          </span>
          <p className="text-caption text-danger">
            {t('payments.late.daysLate', { count: daysLate(entry.graceEndDate) })}
          </p>
        </div>
      ),
    },
    {
      key: 'amountDue',
      header: t('payments.late.columns.amountDue'),
      render: (entry) => (
        // What was already paid sits under the amount: one column less, the actions stay in view.
        <div>
          <span className="text-body text-foreground whitespace-nowrap" dir="ltr">
            {formatDZD(Number(entry.amountDue), i18n.language)}
          </span>
          {Number(entry.totalPaid) > 0 && (
            <p className="text-caption text-success whitespace-nowrap">
              {t('payments.late.columns.totalPaid')} : <span dir="ltr">{formatDZD(Number(entry.totalPaid), i18n.language)}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'outstanding',
      header: t('payments.late.columns.outstanding'),
      render: (entry) => (
        <span className="text-body font-semibold text-danger whitespace-nowrap" dir="ltr">
          {formatDZD(Number(entry.outstanding), i18n.language)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('payments.late.columns.status'),
      render: (entry) => (
        <div>
          <LateBadge
            status={entry.status}
            label={
              entry.status === 'late'
                ? t('payments.late.statusLate')
                : t('payments.late.statusLatePartial')
            }
          />
          {entry.lastReminderAt && (
            <p className="text-micro text-text-secondary mt-1 whitespace-nowrap">
              {remindedLabel(entry.lastReminderAt)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (entry) => (
        <div className="flex items-center justify-end gap-1">
          {canCollect && entry.childId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/admin/payments?pay=${entry.childId}`)}
            >
              <Banknote className="w-4 h-4" />
              {t('payments.late.collect')}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t('payments.late.reminder.send')}
            aria-label={t('payments.late.reminder.send')}
            onClick={() => setRemindEntry(entry)}
          >
            <BellRing className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t('payments.late.account.open')}
            aria-label={t('payments.late.account.open')}
            onClick={() => setAccountChild({ id: entry.childId, name: entry.childName })}
          >
            <Wallet className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title={t('payments.late.title')} description={t('payments.late.description')} />

      <FilterBar
        search={{ onSearch: setSearch, placeholder: t('payments.late.filters.searchPlaceholder'), defaultValue: search }}
        activeCount={[classroomFilter, feeFilter, minDays, statusFilter].filter(Boolean).length}
        summary={t('payments.late.filters.summary', {
          periods: entries.length,
          children: childCount,
          amount: formatDZD(totalOutstanding, i18n.language),
        })}
        onReset={resetFilters}
        columns={3}
        chips={<FilterChips label={t('payments.late.filterStatus')} value={statusFilter} onChange={setStatusFilter} options={statusOptions} />}
      >
          <FormSelect
            label={t('payments.late.filters.classroom')}
            name="classroomFilter"
            value={classroomFilter}
            onChange={(e) => setClassroomFilter(e.target.value)}
            options={[{ value: '', label: t('payments.late.filters.allClassrooms') }, ...classroomOptions]}
          />
          <FormSelect
            label={t('payments.late.filters.fee')}
            name="feeFilter"
            value={feeFilter}
            onChange={(e) => setFeeFilter(e.target.value)}
            options={[{ value: '', label: t('payments.late.filters.allFees') }, ...feeOptions]}
          />
          <FormSelect
            label={t('payments.late.filters.minDays')}
            name="minDaysFilter"
            value={minDays}
            onChange={(e) => setMinDays(e.target.value)}
            options={[
              { value: '', label: t('payments.late.filters.anyDelay') },
              ...MIN_DAYS_OPTIONS.map((d) => ({ value: d, label: t('payments.late.filters.moreThanDays', { count: Number(d) }) })),
            ]}
          />
      </FilterBar>

      {/* Data Table */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-text-disabled mx-auto mb-3" />
          <p className="text-body text-text-secondary">
            {hasFilters && (allEntries ?? []).length > 0 ? t('payments.late.filters.noMatch') : t('payments.late.empty')}
          </p>
        </div>
      ) : (
        <DataTable<LateDashboardEntry>
          columns={columns}
          data={entries}
          keyExtractor={(entry) => entry.id}
          emptyMessage={t('payments.late.empty')}
        />
      )}

      <LateReminderDialog
        entry={remindEntry}
        feeLabel={remindEntry ? feeLabel(remindEntry) : ''}
        daysLate={remindEntry ? daysLate(remindEntry.graceEndDate) : 0}
        onOpenChange={(open) => !open && setRemindEntry(null)}
      />
      {accountChild && (
        <ChildAccountDialog
          childId={accountChild.id}
          childName={accountChild.name}
          open
          onOpenChange={(open) => !open && setAccountChild(null)}
        />
      )}
    </div>
  );
}
