import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Plus, Trash2, CheckCircle, AlertCircle, Minus, Eye, Filter, X } from 'lucide-react';
import { formatDate, formatDZD } from '@/lib/formatters';
import {
  Button,
  CreateButton,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import { useChildren } from '@/hooks/useChildren';
import { useDefaultBranch } from '@/hooks/useDefaultBranch';
import {
  useChildBillingPeriods,
  useRecordPayment,
  usePaymentRecords,
  type PaymentChannel,
  type PaymentAllocationInput,
  type PaymentRecord,
  type PaymentRecordFilters,
  type RecordPaymentResult,
} from '@/hooks/usePayments';
import { RecordCorrectionDialog } from './RecordCorrectionDialog';
import { ReceiptView } from './ReceiptView';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CHANNELS: PaymentChannel[] = ['cash', 'ccp', 'baridimob'];
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 9_999_999.99;

function isValidAmount(value: string): boolean {
  if (!value.trim()) return false;
  const num = Number(value);
  if (isNaN(num)) return false;
  if (num < AMOUNT_MIN || num > AMOUNT_MAX) return false;
  const parts = value.split('.');
  if (parts.length > 1 && parts[1].length > 2) return false;
  return true;
}

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ─── Allocation Row ────────────────────────────────────────────────────────────

interface AllocationRow {
  id: string;
  billingPeriodId: string;
  amount: string;
}

function createEmptyAllocation(): AllocationRow {
  return { id: crypto.randomUUID(), billingPeriodId: '', amount: '' };
}

// ─── Record Payment Dialog ─────────────────────────────────────────────────────

function RecordPaymentDialog({
  open,
  onOpenChange,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}) {
  const { t, i18n } = useTranslation();
  const recordPayment = useRecordPayment(branchId);
  const { data: childrenData } = useChildren({ pageSize: 100 });

  const [childId, setChildId] = React.useState('');
  const [totalAmount, setTotalAmount] = React.useState('');
  const [channel, setChannel] = React.useState<PaymentChannel>('cash');
  const [valueDate, setValueDate] = React.useState(getTodayString());
  const [referenceNote, setReferenceNote] = React.useState('');
  const [allocations, setAllocations] = React.useState<AllocationRow[]>([
    createEmptyAllocation(),
  ]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<RecordPaymentResult | null>(null);

  // Fetch billing periods for the selected child
  const { data: billingPeriods } = useChildBillingPeriods(childId);

  // Filter to non-cancelled, non-paid periods that still have outstanding amount
  const availablePeriods = React.useMemo(() => {
    if (!billingPeriods) return [];
    return billingPeriods.filter(
      (p) => !p.cancelledAt && p.status !== 'paid'
    );
  }, [billingPeriods]);

  /**
   * Sort available periods by priority:
   * 1. Late periods first (isLate === true), sorted by dueDate ascending (oldest first)
   * 2. Then non-late periods sorted by dueDate ascending (closest first)
   */
  const sortedPeriodsByPriority = React.useMemo(() => {
    return [...availablePeriods].sort((a, b) => {
      // Late periods come first
      const aLate = a.isLate ? 1 : 0;
      const bLate = b.isLate ? 1 : 0;
      if (aLate !== bLate) return bLate - aLate;
      // Within same late/non-late group, sort by dueDate ascending
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [availablePeriods]);

  /**
   * Suggest allocations based on priority (late periods first, then closest due date).
   * Distributes the total amount across periods, filling each up to its outstanding amount.
   */
  function suggestAllocations() {
    const amount = Number(totalAmount);
    if (!amount || amount <= 0 || sortedPeriodsByPriority.length === 0) return;

    let remaining = amount;
    const suggested: AllocationRow[] = [];

    for (const period of sortedPeriodsByPriority) {
      if (remaining <= 0) break;

      const outstanding = Number(period.outstanding ?? period.amountDue);
      if (outstanding <= 0) continue;

      const allocAmount = Math.min(remaining, outstanding);
      // Round to 2 decimal places
      const rounded = Math.round(allocAmount * 100) / 100;

      if (rounded >= 0.01) {
        suggested.push({
          id: crypto.randomUUID(),
          billingPeriodId: period.id,
          amount: rounded.toFixed(2),
        });
        remaining = Math.round((remaining - rounded) * 100) / 100;
      }
    }

    // If we still have remaining amount but no more periods, add it to the last allocation
    // (the user can manually adjust)
    if (remaining > 0 && suggested.length > 0) {
      const last = suggested[suggested.length - 1];
      const newAmount = Number(last.amount) + remaining;
      suggested[suggested.length - 1] = {
        ...last,
        amount: newAmount.toFixed(2),
      };
    }

    if (suggested.length > 0) {
      setAllocations(suggested);
    }
  }

  // Calculate allocation sum
  const allocationSum = React.useMemo(() => {
    return allocations.reduce((sum, row) => {
      const val = Number(row.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [allocations]);

  const totalAmountNum = Number(totalAmount) || 0;
  const isBalanced =
    totalAmountNum > 0 &&
    Math.abs(allocationSum - totalAmountNum) < 0.005;

  // Auto-suggest allocations when total amount changes and a child is selected
  const prevTotalRef = React.useRef('');
  React.useEffect(() => {
    const amount = Number(totalAmount);
    if (
      childId &&
      amount > 0 &&
      sortedPeriodsByPriority.length > 0 &&
      totalAmount !== prevTotalRef.current
    ) {
      prevTotalRef.current = totalAmount;
      // Only auto-suggest if allocations haven't been manually configured
      const hasManualAllocations = allocations.some(
        (row) => row.billingPeriodId && row.amount
      );
      if (!hasManualAllocations) {
        suggestAllocations();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAmount, childId, sortedPeriodsByPriority]);

  function resetForm() {
    setChildId('');
    setTotalAmount('');
    setChannel('cash');
    setValueDate(getTodayString());
    setReferenceNote('');
    setAllocations([createEmptyAllocation()]);
    setErrors({});
    setResult(null);
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  function addAllocationRow() {
    setAllocations((prev) => [...prev, createEmptyAllocation()]);
  }

  function removeAllocationRow(id: string) {
    setAllocations((prev) => prev.filter((row) => row.id !== id));
  }

  function updateAllocation(
    id: string,
    field: 'billingPeriodId' | 'amount',
    value: string
  ) {
    setAllocations((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!childId) {
      newErrors.childId = t('payments.recording.errors.childRequired');
    }
    if (!totalAmount || !isValidAmount(totalAmount)) {
      newErrors.totalAmount = t('payments.recording.errors.amountInvalid');
    }
    if (!valueDate) {
      newErrors.valueDate = t('payments.recording.errors.valueDateRequired');
    }

    // reference_note required for ccp/baridimob
    if ((channel === 'ccp' || channel === 'baridimob') && !referenceNote.trim()) {
      newErrors.referenceNote = t('payments.recording.errors.referenceRequired');
    }

    // Validate allocations
    const validAllocations = allocations.filter(
      (row) => row.billingPeriodId && row.amount
    );
    if (validAllocations.length === 0) {
      newErrors.allocations = t('payments.recording.errors.allocationRequired');
    }

    // Validate allocation amounts
    for (const row of validAllocations) {
      if (!isValidAmount(row.amount)) {
        newErrors.allocations = t('payments.recording.errors.allocationAmountInvalid');
        break;
      }
      // Validate allocation does not exceed outstanding for the period
      const period = availablePeriods.find((p) => p.id === row.billingPeriodId);
      if (period) {
        const outstanding = Number(period.outstanding ?? period.amountDue);
        if (Number(row.amount) > outstanding) {
          newErrors.allocations = t('payments.recording.errors.allocationExceedsOutstanding', {
            amount: Number(row.amount).toFixed(2),
            outstanding: outstanding.toFixed(2),
          });
          break;
        }
      }
    }

    // Validate sum matches total
    if (!newErrors.allocations && !newErrors.totalAmount && !isBalanced) {
      newErrors.allocations = t('payments.recording.errors.allocationMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const validAllocations: PaymentAllocationInput[] = allocations
      .filter((row) => row.billingPeriodId && row.amount)
      .map((row) => ({
        billingPeriodId: row.billingPeriodId,
        amount: Number(row.amount),
      }));

    try {
      const res = await recordPayment.mutateAsync({
        childId,
        totalAmount: Number(totalAmount),
        channel,
        valueDate,
        referenceNote: referenceNote.trim() || undefined,
        allocations: validAllocations,
      });
      setResult(res);
    } catch {
      // Error handled by react-query
    }
  }

  // Build period options for select — sorted by priority (late first, then closest)
  const periodOptions = React.useMemo(() => {
    return sortedPeriodsByPriority.map((p) => {
      let label: string;
      if (p.branchFeeName) {
        // Fee period: show the fee name
        label = p.branchFeeName;
      } else if (p.isRegistrationPeriod) {
        label = t('payments.recording.registrationPeriod');
      } else {
        // Monthly/recurring period: show date range
        label = `${formatDate(p.periodStart)} - ${formatDate(p.periodEnd)}`;
      }
      const outstanding = Number(p.outstanding ?? p.amountDue);
      const suffix = p.isLate
        ? ` ⚠ ${formatDZD(outstanding, i18n.language)}`
        : ` — ${formatDZD(outstanding, i18n.language)}`;
      return {
        value: p.id,
        label: `${label}${suffix}`,
      };
    });
  }, [sortedPeriodsByPriority, t, i18n.language]);

  const childOptions = (childrenData?.children ?? []).map((c) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const channelOptions = CHANNELS.map((ch) => ({
    value: ch,
    label: t(`payments.recording.channels.${ch}`),
  }));

  // Success view
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                {t('payments.recording.success.title')}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 bg-subtle rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.recording.success.receiptNumber')}
              </span>
              <span className="text-body font-semibold text-foreground" dir="ltr">
                {result.receiptNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.recording.success.amount')}
              </span>
              <span className="text-body font-medium text-foreground">
                {formatDZD(Number(result.totalAmount), i18n.language)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.recording.success.channel')}
              </span>
              <span className="text-body font-medium text-foreground">
                {t(`payments.recording.channels.${result.channel}`)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => handleClose(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('payments.recording.title')}</DialogTitle>
          <DialogDescription>
            {t('payments.recording.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Child selection */}
          <FormSelect
            label={t('payments.recording.fields.child')}
            name="childId"
            value={childId}
            onChange={(e) => {
              setChildId(e.target.value);
              setAllocations([createEmptyAllocation()]);
              if (errors.childId) setErrors((prev) => ({ ...prev, childId: '' }));
            }}
            options={childOptions}
            placeholder={t('payments.recording.fields.selectChild')}
            error={errors.childId}
          />

          {/* Amount and Channel row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('payments.recording.fields.totalAmount')}
              htmlFor="payment-total-amount"
              error={errors.totalAmount}
              required
            >
              <Input
                id="payment-total-amount"
                type="number"
                step="0.01"
                min="0.01"
                max="9999999.99"
                value={totalAmount}
                onChange={(e) => {
                  setTotalAmount(e.target.value);
                  if (errors.totalAmount)
                    setErrors((prev) => ({ ...prev, totalAmount: '' }));
                }}
                placeholder="0.00"
              />
            </FormField>

            <FormSelect
              label={t('payments.recording.fields.channel')}
              name="channel"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as PaymentChannel)
              }
              options={channelOptions}
              error={errors.channel}
            />
          </div>

          {/* Value date and reference note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label={t('payments.recording.fields.valueDate')}
              htmlFor="payment-value-date"
              error={errors.valueDate}
              required
            >
              <Input
                id="payment-value-date"
                type="date"
                value={valueDate}
                onChange={(e) => {
                  setValueDate(e.target.value);
                  if (errors.valueDate)
                    setErrors((prev) => ({ ...prev, valueDate: '' }));
                }}
              />
            </FormField>

            <FormField
              label={t('payments.recording.fields.referenceNote')}
              htmlFor="payment-reference-note"
              error={errors.referenceNote}
              required={channel === 'ccp' || channel === 'baridimob'}
            >
              <Input
                id="payment-reference-note"
                type="text"
                maxLength={500}
                value={referenceNote}
                onChange={(e) => {
                  setReferenceNote(e.target.value);
                  if (errors.referenceNote)
                    setErrors((prev) => ({ ...prev, referenceNote: '' }));
                }}
                placeholder={t('payments.recording.fields.referenceNotePlaceholder')}
              />
            </FormField>
          </div>

          {/* Allocations section */}
          <div className="mt-2 mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-label font-medium text-foreground">
                {t('payments.recording.fields.allocations')}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={suggestAllocations}
                  disabled={!childId || !totalAmount || availablePeriods.length === 0}
                  title={t('payments.recording.suggestAllocation')}
                >
                  <Receipt className="w-4 h-4 me-1" />
                  {t('payments.recording.suggestAllocation')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addAllocationRow}
                  disabled={!childId}
                >
                  <Plus className="w-4 h-4 me-1" />
                  {t('payments.recording.addAllocation')}
                </Button>
              </div>
            </div>

            {/* Allocation rows */}
            <div className="space-y-2">
              {allocations.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start gap-2"
                >
                  <div className="flex-1">
                    <select
                      value={row.billingPeriodId}
                      onChange={(e) =>
                        updateAllocation(row.id, 'billingPeriodId', e.target.value)
                      }
                      className="w-full appearance-none bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring"
                      disabled={!childId}
                    >
                      <option value="" disabled>
                        {t('payments.recording.fields.selectPeriod')}
                      </option>
                      {periodOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="9999999.99"
                      value={row.amount}
                      onChange={(e) =>
                        updateAllocation(row.id, 'amount', e.target.value)
                      }
                      placeholder="0.00"
                      disabled={!childId}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAllocationRow(row.id)}
                    disabled={allocations.length <= 1}
                    className="mt-1"
                  >
                    <Trash2 className="w-4 h-4 text-danger" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Allocation sum vs total indicator */}
            {totalAmountNum > 0 && (
              <div className="mt-3 flex items-center gap-2">
                {isBalanced ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-danger" />
                )}
                <span
                  className={`text-caption ${
                    isBalanced ? 'text-success' : 'text-danger'
                  }`}
                >
                  {t('payments.recording.allocationSum', {
                    sum: allocationSum.toFixed(2),
                    total: totalAmountNum.toFixed(2),
                  })}
                </span>
              </div>
            )}

            {errors.allocations && (
              <p className="text-caption text-danger mt-1" role="alert">
                {errors.allocations}
              </p>
            )}
          </div>

          {/* Submit */}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending
                ? t('common.loading')
                : t('payments.recording.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment History Filters ───────────────────────────────────────────────────

function PaymentHistoryFilters({
  filters,
  onFiltersChange,
  onReset,
}: {
  filters: PaymentRecordFilters;
  onFiltersChange: (filters: PaymentRecordFilters) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const { data: childrenData } = useChildren({ pageSize: 100 });

  const childOptions = [
    { value: '', label: t('payments.filters.allChildren') },
    ...(childrenData?.children ?? []).map((c) => ({
      value: c.id,
      label: `${c.first_name} ${c.last_name}`,
    })),
  ];

  const channelOptions = [
    { value: '', label: t('payments.filters.allChannels') },
    { value: 'cash', label: t('payments.recording.channels.cash') },
    { value: 'ccp', label: t('payments.recording.channels.ccp') },
    { value: 'baridimob', label: t('payments.recording.channels.baridimob') },
  ];

  const hasActiveFilters =
    !!filters.startDate || !!filters.endDate || !!filters.channel || !!filters.childId;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-label font-medium text-foreground flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-secondary" />
          {t('payments.filters.title')}
        </span>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-text-secondary"
          >
            <X className="w-3 h-3 me-1" />
            {t('payments.filters.clear')}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Date start */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-start-date"
            className="text-caption text-text-secondary"
          >
            {t('payments.filters.startDate')}
          </label>
          <Input
            id="filter-start-date"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, startDate: e.target.value || undefined })
            }
          />
        </div>
        {/* Date end */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-end-date"
            className="text-caption text-text-secondary"
          >
            {t('payments.filters.endDate')}
          </label>
          <Input
            id="filter-end-date"
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, endDate: e.target.value || undefined })
            }
          />
        </div>
        {/* Channel filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-channel"
            className="text-caption text-text-secondary"
          >
            {t('payments.filters.channel')}
          </label>
          <select
            id="filter-channel"
            value={filters.channel ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, channel: e.target.value || undefined })
            }
            className="w-full appearance-none bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring"
          >
            {channelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {/* Child filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-child"
            className="text-caption text-text-secondary"
          >
            {t('payments.filters.child')}
          </label>
          <select
            id="filter-child"
            value={filters.childId ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, childId: e.target.value || undefined })
            }
            className="w-full appearance-none bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring"
          >
            {childOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Payments Page ─────────────────────────────────────────────────────────────

export function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const { branchId: selectedBranchId } = useDefaultBranch();
  const [recordDialogOpen, setRecordDialogOpen] = React.useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = React.useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = React.useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<PaymentRecordFilters>({});

  const { data: records, isLoading } = usePaymentRecords(selectedBranchId, filters);

  function handleViewReceipt(record: PaymentRecord) {
    setSelectedPaymentId(record.id);
    setReceiptDialogOpen(true);
  }

  function handleResetFilters() {
    setFilters({});
  }

  const columns: Column<PaymentRecord>[] = [
    {
      key: 'receiptNumber',
      header: t('payments.recording.columns.receiptNumber'),
      render: (record) => (
        <span className="text-body font-medium text-foreground" dir="ltr">
          {record.receiptNumber}
        </span>
      ),
    },
    {
      key: 'child',
      header: t('payments.recording.columns.child'),
      render: (record) => (
        <span className="text-body text-foreground">
          {record.child
            ? `${record.child.firstName} ${record.child.lastName}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: t('payments.recording.columns.amount'),
      render: (record) => (
        <span
          className={`text-body font-medium ${
            record.isCorrection ? 'text-danger' : 'text-foreground'
          }`}
          dir="ltr"
        >
          {record.isCorrection ? '-' : ''}
          {formatDZD(Math.abs(Number(record.totalAmount)), i18n.language)}
        </span>
      ),
    },
    {
      key: 'channel',
      header: t('payments.recording.columns.channel'),
      render: (record) => (
        <span className="text-body text-foreground">
          {t(`payments.recording.channels.${record.channel}`)}
        </span>
      ),
    },
    {
      key: 'valueDate',
      header: t('payments.recording.columns.valueDate'),
      render: (record) => (
        <span className="text-body text-text-secondary" dir="ltr">
          {formatDate(record.valueDate)}
        </span>
      ),
    },
    {
      key: 'type',
      header: t('payments.recording.columns.type'),
      render: (record) => (
        <div className="flex flex-col gap-0.5">
          <span
            className={`text-caption px-2 py-0.5 rounded-full inline-block w-fit ${
              record.isCorrection
                ? 'bg-danger/10 text-danger'
                : 'bg-success/10 text-success'
            }`}
          >
            {record.isCorrection
              ? t('payments.recording.typeCorrection')
              : t('payments.recording.typePayment')}
          </span>
          {record.isCorrection && record.correctsPaymentId && (
            <span className="text-caption text-text-secondary" dir="ltr">
              {t('payments.recording.columns.correctsPayment', {
                id: record.correctsPaymentId.slice(0, 8),
              })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (record) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewReceipt(record);
          }}
          aria-label={t('payments.receipt.viewReceipt')}
          title={t('payments.receipt.viewReceipt')}
        >
          <Eye className="w-4 h-4 text-primary" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-primary" />
          <h1 className="text-page-title font-semibold text-text-heading">
            {t('payments.records.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setCorrectionDialogOpen(true)}
          >
            <Minus className="w-4 h-4" />
            {t('payments.correction.openButton')}
          </Button>
          <CreateButton
            label={t('payments.recording.record')}
            onClick={() => setRecordDialogOpen(true)}
          />
        </div>
      </div>

      <p className="text-body text-text-secondary">
        {t('payments.records.description')}
      </p>

      {/* Filters */}
      <PaymentHistoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Payment records table */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      ) : (
        <DataTable<PaymentRecord>
          columns={columns}
          data={records ?? []}
          keyExtractor={(record) => record.id}
          emptyMessage={t('payments.recording.empty')}
        />
      )}

      {/* Record Payment Dialog */}
      {selectedBranchId && (
        <RecordPaymentDialog
          open={recordDialogOpen}
          onOpenChange={setRecordDialogOpen}
          branchId={selectedBranchId}
        />
      )}

      {/* Record Correction Dialog */}
      {selectedBranchId && (
        <RecordCorrectionDialog
          open={correctionDialogOpen}
          onOpenChange={setCorrectionDialogOpen}
          branchId={selectedBranchId}
        />
      )}

      {/* Receipt View */}
      <ReceiptView
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        paymentRecordId={selectedPaymentId}
      />
    </div>
  );
}
