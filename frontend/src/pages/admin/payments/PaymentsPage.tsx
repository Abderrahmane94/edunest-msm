import { errorMessage } from '@/lib/errorMessage';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Plus, Trash2, CheckCircle, AlertCircle, Minus, Eye, WifiOff, CloudUpload } from 'lucide-react';
import { bidiIsolate, formatDate, formatDateTime, formatDZD, formatMonthYear } from '@/lib/formatters';
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
import { useBranchFees } from '@/hooks/useBranchFees';
import {
  useChildBillingPeriods,
  usePaymentRecords,
  type BillingPeriod,
  type PaymentChannel,
  type PaymentRecord,
  type PaymentRecordFilters,
  type RecordPaymentResult,
} from '@/hooks/usePayments';
import {
  useOfflinePaymentsSnapshot,
  useQueuedPayments,
  pendingAmountsByPeriod,
  provisionalRef,
  sendPayment,
  savePaymentOffline,
  paymentRefusalText,
  type OfflinePaymentPayload,
} from '@/hooks/useOfflinePayments';
import { useAuth } from '@/contexts/AuthContext';
import { useOnline } from '@/lib/online';
import { ApiRequestError } from '@/lib/api-client';
import { discardAction, replaceAction, type QueuedAction } from '@/lib/offlineQueue';
import { RecordCorrectionDialog } from './RecordCorrectionDialog';
import { ReceiptView } from './ReceiptView';
import { ProvisionalReceiptDialog } from './ProvisionalReceiptDialog';
import { OfflinePaymentsPanel } from './OfflinePaymentsPanel';
import { suggestAllocations as suggestAllocationsUtil } from '@/lib/paymentAllocation';
import { FilterBar, SectionHeader, StatusBadge } from '@/components/ui';

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

/**
 * Records a payment. Offline (or when the server can't be reached) the
 * payment is kept on the device and sent later, with a provisional receipt;
 * échéances then come from the copy kept on the device. `fixAction` opens a
 * payment kept on the device to allocate it or correct it.
 */
function RecordPaymentDialog({
  open,
  onOpenChange,
  branchId,
  fixAction = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  fixAction?: QueuedAction<OfflinePaymentPayload> | null;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const { data: childrenData } = useChildren({ pageSize: 100 });
  const snapshot = useOfflinePaymentsSnapshot(branchId);
  const { queued } = useQueuedPayments();
  const [clientId, setClientId] = React.useState<string>(() => crypto.randomUUID());
  const [saving, setSaving] = React.useState(false);
  // Saved on the device (not yet on the server): shown with its provisional receipt.
  const [savedOffline, setSavedOffline] = React.useState<OfflinePaymentPayload | null>(null);
  const [provisionalOpen, setProvisionalOpen] = React.useState(false);

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
  const prevTotalRef = React.useRef('');

  // A payment kept on the device, opened to allocate or correct it.
  React.useEffect(() => {
    if (!open || !fixAction) return;
    const p = fixAction.payload;
    setClientId(p.clientId);
    setChildId(p.childId);
    setTotalAmount(String(p.totalAmount));
    setChannel(p.channel);
    setValueDate(p.valueDate);
    setReferenceNote(p.referenceNote ?? '');
    setAllocations(
      p.allocations.length > 0
        ? p.allocations.map((a) => ({ id: crypto.randomUUID(), billingPeriodId: a.billingPeriodId, amount: String(a.amount) }))
        : [createEmptyAllocation()],
    );
  }, [open, fixAction]);

  // Billing periods for the selected child: from the server when online,
  // from the copy kept on the device when offline.
  const { data: livePeriods } = useChildBillingPeriods(childId);
  const snapshotChild = snapshot.data?.children.find((c) => c.id === childId);
  const billingPeriods: BillingPeriod[] | undefined = online
    ? (livePeriods ?? snapshotChild?.periods)
    : (snapshotChild?.periods ?? livePeriods);
  // Offline with nothing kept for this child: the payment is saved "to allocate".
  const periodsUnavailable = !online && !!childId && !billingPeriods;

  // Amounts taken by payments still on the device: the server doesn't know them yet.
  const pendingAmounts = React.useMemo(
    () => pendingAmountsByPeriod(queued, fixAction?.id),
    [queued, fixAction?.id],
  );

  // Filter to non-cancelled, non-paid periods that still have outstanding amount
  const availablePeriods = React.useMemo(() => {
    if (!billingPeriods) return [];
    return billingPeriods
      .filter((p) => !p.cancelledAt && p.status !== 'paid')
      .map((p) => {
        const taken = pendingAmounts.get(p.id);
        if (!taken) return p;
        const left = Math.round((Number(p.outstanding ?? p.amountDue) - taken) * 100) / 100;
        return { ...p, outstanding: String(left) };
      })
      .filter((p) => Number(p.outstanding ?? p.amountDue) > 0.005);
  }, [billingPeriods, pendingAmounts]);

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
    const suggested = suggestAllocationsUtil(availablePeriods, amount);
    if (suggested.length > 0) {
      setAllocations(suggested.map((s) => ({ id: crypto.randomUUID(), ...s })));
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
  // (prevTotalRef is declared above, with the state.)
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
    setClientId(crypto.randomUUID());
    setSavedOffline(null);
    setProvisionalOpen(false);
    prevTotalRef.current = '';
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
    if (errors.form || errors.allocations) setErrors((prev) => ({ ...prev, form: '', allocations: '' }));
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

    // Offline without this child's échéances: saved "to allocate", without any.
    if (periodsUnavailable) {
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    // Validate allocations
    const validAllocations = allocations.filter(
      (row) => row.billingPeriodId && row.amount
    );
    if (validAllocations.length === 0) {
      newErrors.allocations = t('payments.recording.errors.allocationRequired');
    }

    // A period can only be allocated once per payment.
    const periodIds = validAllocations.map((row) => row.billingPeriodId);
    if (new Set(periodIds).size !== periodIds.length) {
      newErrors.allocations = t('payments.recording.errors.allocationDuplicatePeriod');
    }

    // Validate allocation amounts
    for (const row of newErrors.allocations ? [] : validAllocations) {
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

    const payload: OfflinePaymentPayload = {
      clientId,
      branchId,
      childId,
      childName: childOptions.find((c) => c.value === childId)?.label ?? '',
      totalAmount: Number(totalAmount),
      channel,
      valueDate,
      referenceNote: referenceNote.trim() || undefined,
      allocations: periodsUnavailable
        ? []
        : allocations
            .filter((row) => row.billingPeriodId && row.amount)
            .map((row) => {
              const period = availablePeriods.find((p) => p.id === row.billingPeriodId);
              return {
                billingPeriodId: row.billingPeriodId,
                amount: Number(row.amount),
                label: period ? periodLabel(period) : '',
              };
            }),
      recordedAt: new Date().toISOString(),
      recordedByName: user ? `${user.firstName} ${user.lastName}` : '',
    };

    setSaving(true);
    try {
      if (online && payload.allocations.length > 0) {
        try {
          const res = await sendPayment(payload);
          if (fixAction) discardAction(fixAction.id);
          setResult(res);
          return;
        } catch (err) {
          if (err instanceof ApiRequestError) {
            const reason = err.meta?.reason;
            setErrors((prev) => ({
              ...prev,
              form: typeof reason === 'string' ? paymentRefusalText(t, `reason:${reason}`) : errorMessage(err, t),
            }));
            return;
          }
          // The server couldn't be reached: keep the payment on the device.
        }
      }
      if (fixAction) replaceAction(fixAction.id, payload);
      else await savePaymentOffline(payload);
      setSavedOffline(payload);
    } catch {
      setErrors((prev) => ({ ...prev, form: t('common.error') }));
    } finally {
      setSaving(false);
    }
  }

  /** What discounts took off an échéance (0 when none). */
  function discountOf(p: { amountDue: string; baseAmount?: string | null }): number {
    if (p.baseAmount == null) return 0;
    return Math.max(0, Math.round((Number(p.baseAmount) - Number(p.amountDue)) * 100) / 100);
  }

  /**
   * Names an échéance: its fee and month, "registration", or its dates. Each
   * part is bidi-isolated: fee names are often Arabic while the rest may be
   * French, and unisolated the browser reorders them (amount before the name).
   */
  function periodLabel(p: BillingPeriod): string {
    if (p.branchFeeName) {
      return `${bidiIsolate(p.branchFeeName)} (${bidiIsolate(formatMonthYear(p.periodStart, i18n.language))})`;
    }
    if (p.isRegistrationPeriod) return bidiIsolate(t('payments.recording.registrationPeriod'));
    return `${bidiIsolate(formatDate(p.periodStart))} - ${bidiIsolate(formatDate(p.periodEnd))}`;
  }

  // Build period options for select — sorted by priority (late first, then closest)
  const periodOptions = React.useMemo(() => {
    return sortedPeriodsByPriority.map((p) => {
      const label = periodLabel(p);
      const outstanding = Number(p.outstanding ?? p.amountDue);
      const amount = bidiIsolate(formatDZD(outstanding, i18n.language));
      const suffix = p.isLate ? ` ⚠ ${amount}` : ` — ${amount}`;
      const saved = discountOf(p);
      const discountNote =
        saved > 0
          ? ` · ${bidiIsolate(t('payments.recording.discountShort', { amount: formatDZD(saved, i18n.language) }))}`
          : '';
      return {
        value: p.id,
        label: `${label}${suffix}${discountNote}`,
      };
    });
  }, [sortedPeriodsByPriority, t, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every billed child (kept on the device) and the school's children list,
  // so a child added a moment ago is there too.
  const childOptions = React.useMemo(() => {
    const options = new Map<string, string>();
    for (const c of snapshot.data?.children ?? []) options.set(c.id, `${c.firstName} ${c.lastName}`);
    for (const c of childrenData?.children ?? []) {
      if (!options.has(c.id)) options.set(c.id, `${c.first_name} ${c.last_name}`);
    }
    return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [snapshot.data, childrenData]);

  const channelOptions = CHANNELS.map((ch) => ({
    value: ch,
    label: t(`payments.recording.channels.${ch}`),
  }));

  // Saved on the device: sent when the connection returns.
  if (savedOffline) {
    return (
      <>
        <Dialog open={open && !provisionalOpen} onOpenChange={handleClose}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                <span className="inline-flex items-center gap-2">
                  <CloudUpload className="w-5 h-5 text-warning" />
                  {t('payments.offline.saved.title')}
                </span>
              </DialogTitle>
              <DialogDescription>
                {savedOffline.allocations.length > 0
                  ? t('payments.offline.saved.text')
                  : t('payments.offline.saved.toAllocate')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 bg-subtle rounded-lg p-4">
              <div className="flex justify-between gap-3">
                <span className="text-body text-text-secondary">{t('payments.offline.saved.reference')}</span>
                <span className="text-body font-semibold text-foreground" dir="ltr">
                  {provisionalRef(savedOffline)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-body text-text-secondary">{savedOffline.childName}</span>
                <span className="text-body font-medium text-foreground">
                  {formatDZD(savedOffline.totalAmount, i18n.language)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setProvisionalOpen(true)}>
                <Receipt className="w-4 h-4" />
                {t('payments.offline.actions.provisionalReceipt')}
              </Button>
              <Button onClick={() => handleClose(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ProvisionalReceiptDialog
          payment={savedOffline}
          open={open && provisionalOpen}
          onOpenChange={setProvisionalOpen}
        />
      </>
    );
  }

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
          <DialogTitle>
            {fixAction
              ? t(fixAction.error === 'NEEDS_ALLOCATION' ? 'payments.offline.allocateTitle' : 'payments.offline.fixTitle', {
                  ref: provisionalRef(fixAction.payload),
                })
              : t('payments.recording.title')}
          </DialogTitle>
          <DialogDescription>
            {fixAction?.error ? paymentRefusalText(t, fixAction.error) : t('payments.recording.description')}
          </DialogDescription>
        </DialogHeader>

        {!online && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-caption text-foreground">
            <WifiOff className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
            <span>
              {periodsUnavailable
                ? t('payments.offline.noSnapshot')
                : snapshot.data
                  ? t('payments.offline.snapshotDate', { date: formatDateTime(snapshot.data.generatedAt) })
                  : t('payments.offline.offlineForm')}
            </span>
          </div>
        )}

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

          {/* Allocations section (not offline without this child's échéances) */}
          <div className={periodsUnavailable ? 'hidden' : 'mt-2 mb-4'}>
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
                  <div className="flex-1 space-y-1">
                    <select
                      value={row.billingPeriodId}
                      onChange={(e) =>
                        updateAllocation(row.id, 'billingPeriodId', e.target.value)
                      }
                      className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring"
                      disabled={!childId}
                    >
                      <option value="" disabled>
                        {t('payments.recording.fields.selectPeriod')}
                      </option>
                      {/* Periods already chosen in another row aren't offered again. */}
                      {periodOptions
                        .filter(
                          (opt) =>
                            !allocations.some(
                              (other) => other.id !== row.id && other.billingPeriodId === opt.value,
                            ),
                        )
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                    {(() => {
                      // The discount on the chosen échéance, spelled out.
                      const chosen = availablePeriods.find((p) => p.id === row.billingPeriodId);
                      const saved = chosen ? discountOf(chosen) : 0;
                      if (!chosen || saved <= 0) return null;
                      return (
                        <p className="text-caption text-primary">
                          {t('payments.recording.discountApplied', {
                            amount: formatDZD(saved, i18n.language),
                            original: formatDZD(Number(chosen.baseAmount), i18n.language),
                          })}
                        </p>
                      );
                    })()}
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

          {/* Error returned by the server when saving */}
          {errors.form && (
            <div
              className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Submit */}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? t('common.loading')
                : online
                  ? t('payments.recording.submit')
                  : t('payments.offline.submitOffline')}
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
  const { branchId } = useDefaultBranch();
  const { data: fees } = useBranchFees(branchId);

  // Receipt-number search as you type, one request once typing pauses.
  const [receiptInput, setReceiptInput] = React.useState(filters.receipt ?? '');
  React.useEffect(() => {
    if (!filters.receipt) setReceiptInput('');
  }, [filters.receipt]);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const receipt = receiptInput.trim() || undefined;
      if (receipt !== filters.receipt) onFiltersChange({ ...filters, receipt });
    }, 300);
    return () => clearTimeout(timer);
  }, [receiptInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeOptions = [
    { value: '', label: t('payments.filters.allTypes') },
    { value: 'payment', label: t('payments.filters.typePayment') },
    { value: 'correction', label: t('payments.filters.typeCorrection') },
  ];

  const feeOptions = [
    { value: '', label: t('payments.filters.allFees') },
    ...(fees ?? []).map((f) => ({ value: f.id, label: f.name })),
  ];

  const selectClassName =
    'w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring';

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

  return (
    <FilterBar activeCount={Object.values(filters).filter(Boolean).length} onReset={onReset}>
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
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring"
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
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring"
          >
            {childOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {/* Receipt number */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-receipt" className="text-caption text-text-secondary">
            {t('payments.filters.receipt')}
          </label>
          <Input
            id="filter-receipt"
            value={receiptInput}
            onChange={(e) => setReceiptInput(e.target.value)}
            placeholder={t('payments.filters.receiptPlaceholder')}
            dir="ltr"
          />
        </div>
        {/* Fee */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-fee" className="text-caption text-text-secondary">
            {t('payments.filters.fee')}
          </label>
          <select
            id="filter-fee"
            value={filters.feeId ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, feeId: e.target.value || undefined })}
            className={selectClassName}
          >
            {feeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {/* Type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-type" className="text-caption text-text-secondary">
            {t('payments.filters.type')}
          </label>
          <select
            id="filter-type"
            value={filters.type ?? ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                type: (e.target.value || undefined) as PaymentRecordFilters['type'],
              })
            }
            className={selectClassName}
          >
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
    </FilterBar>
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
  // A payment kept on the device, opened to allocate or correct it.
  const [fixAction, setFixAction] = React.useState<QueuedAction<OfflinePaymentPayload> | null>(null);
  const [provisionalPayment, setProvisionalPayment] = React.useState<OfflinePaymentPayload | null>(null);

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
          <StatusBadge variant={record.isCorrection ? 'danger' : 'success'} className="w-fit">
            {record.isCorrection
              ? t('payments.recording.typeCorrection')
              : t('payments.recording.typePayment')}
          </StatusBadge>
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
      <SectionHeader
        title={t('nav.paymentsRecords')}
        description={t('payments.records.description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCorrectionDialogOpen(true)}>
              <Minus className="w-4 h-4" />
              {t('payments.correction.openButton')}
            </Button>
            <CreateButton label={t('payments.recording.record')} onClick={() => setRecordDialogOpen(true)} />
          </>
        }
      />

      {/* Payments kept on the device (recorded offline) */}
      <OfflinePaymentsPanel
        onFix={(action) => setFixAction(action)}
        onShowProvisional={(payment) => setProvisionalPayment(payment)}
        onShowReceipt={(paymentId) => {
          setSelectedPaymentId(paymentId);
          setReceiptDialogOpen(true);
        }}
      />

      {/* Filters */}
      <PaymentHistoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Summary of the filtered payments */}
      {!isLoading && records && (
        <p className="text-caption text-text-secondary">
          {t('payments.filters.summary', {
            count: records.length,
            amount: formatDZD(
              records.reduce((sum, r) => sum + Number(r.totalAmount), 0),
              i18n.language,
            ),
          })}
        </p>
      )}

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

      {/* Allocate / correct a payment kept on the device */}
      {selectedBranchId && fixAction && (
        <RecordPaymentDialog
          open
          onOpenChange={(isOpen) => !isOpen && setFixAction(null)}
          branchId={fixAction.payload.branchId || selectedBranchId}
          fixAction={fixAction}
        />
      )}

      <ProvisionalReceiptDialog
        payment={provisionalPayment}
        open={!!provisionalPayment}
        onOpenChange={(isOpen) => !isOpen && setProvisionalPayment(null)}
      />

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
