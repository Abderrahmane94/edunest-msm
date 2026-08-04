import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle, Minus } from 'lucide-react';
import { formatDZD, formatDate } from '@/lib/formatters';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import { FormField, FormSelect } from '@/components/forms';
import {
  usePaymentRecords,
  usePaymentRecordDetail,
  useRecordCorrection,
  type PaymentRecord,
  type PaymentChannel,
} from '@/hooks/usePayments';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CorrectionAllocation {
  billingPeriodId: string;
  periodLabel: string;
  originalAmount: number;
  remainingCorrectable: number;
  correctionAmount: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

// ─── Channel Options ─────────────────────────────────────────────────────────

const CHANNELS: PaymentChannel[] = ['cash', 'ccp', 'baridimob'];

// ─── Component ───────────────────────────────────────────────────────────────

export function RecordCorrectionDialog({ open, onOpenChange, branchId }: Props) {
  const { t, i18n } = useTranslation();
  const recordCorrection = useRecordCorrection();

  // Form state
  const [selectedPaymentId, setSelectedPaymentId] = React.useState('');
  const [channel, setChannel] = React.useState<PaymentChannel>('cash');
  const [valueDate, setValueDate] = React.useState(
    new Date().toISOString().split('T')[0]
  );
  const [referenceNote, setReferenceNote] = React.useState('');
  const [allocations, setAllocations] = React.useState<CorrectionAllocation[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [success, setSuccess] = React.useState(false);
  const [resultReceiptNumber, setResultReceiptNumber] = React.useState('');

  // Fetch payment records (non-corrections only) for selection
  const { data: allRecords } = usePaymentRecords(branchId);
  const originalPayments = React.useMemo(() => {
    if (!allRecords) return [];
    return allRecords.filter((r) => !r.isCorrection);
  }, [allRecords]);

  // Fetch details of the selected payment (with allocations)
  const { data: selectedPayment } = usePaymentRecordDetail(
    selectedPaymentId || null
  );

  // Build allocation rows when a payment is selected
  React.useEffect(() => {
    if (!selectedPayment?.allocations) {
      setAllocations([]);
      return;
    }

    const rows: CorrectionAllocation[] = selectedPayment.allocations.map(
      (alloc) => {
        const bp = alloc.billingPeriod;
        const originalAmount = Math.abs(Number(alloc.amount));
        const periodLabel = bp
          ? bp.isRegistrationPeriod
            ? t('payments.correction.registrationPeriod')
            : `${formatDate(bp.periodStart)} – ${formatDate(bp.periodEnd)}`
          : alloc.billingPeriodId.slice(0, 8);

        return {
          billingPeriodId: alloc.billingPeriodId,
          periodLabel,
          originalAmount,
          remainingCorrectable: originalAmount,
          correctionAmount: '',
        };
      }
    );

    setAllocations(rows);
  }, [selectedPayment, t]);

  // ─── Derived values ──────────────────────────────────────────────────────

  const totalCorrection = React.useMemo(() => {
    return allocations.reduce((sum, a) => {
      const val = Number(a.correctionAmount) || 0;
      return sum + val;
    }, 0);
  }, [allocations]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function resetForm() {
    setSelectedPaymentId('');
    setChannel('cash');
    setValueDate(new Date().toISOString().split('T')[0]);
    setReferenceNote('');
    setAllocations([]);
    setErrors({});
    setSuccess(false);
    setResultReceiptNumber('');
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  }

  function handleAllocationChange(index: number, value: string) {
    setAllocations((prev) =>
      prev.map((a, i) => (i === index ? { ...a, correctionAmount: value } : a))
    );
    if (errors.allocations) {
      setErrors((prev) => ({ ...prev, allocations: '' }));
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedPaymentId) {
      newErrors.payment = t('payments.correction.errors.paymentRequired');
    }
    if (!channel) {
      newErrors.channel = t('payments.correction.errors.channelRequired');
    }
    if (!valueDate) {
      newErrors.valueDate = t('payments.correction.errors.valueDateRequired');
    }

    const trimmedNote = referenceNote.trim();
    if (!trimmedNote) {
      newErrors.referenceNote = t(
        'payments.correction.errors.referenceNoteRequired'
      );
    } else if (trimmedNote.length > 500) {
      newErrors.referenceNote = t(
        'payments.correction.errors.referenceNoteTooLong'
      );
    }

    if (totalCorrection <= 0) {
      newErrors.allocations = t('payments.correction.errors.noAmountEntered');
    }

    // Check each allocation doesn't exceed its max
    for (const alloc of allocations) {
      const val = Number(alloc.correctionAmount) || 0;
      if (val < 0) {
        newErrors.allocations = t('payments.correction.errors.negativeAmount');
        break;
      }
      if (val > alloc.remainingCorrectable) {
        newErrors.allocations = t(
          'payments.correction.errors.allocationExceedsMax'
        );
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!selectedPayment) return;

    const correctionAllocations = allocations
      .filter((a) => Number(a.correctionAmount) > 0)
      .map((a) => ({
        billingPeriodId: a.billingPeriodId,
        amount: -Math.abs(Number(a.correctionAmount)),
      }));

    try {
      const result = await recordCorrection.mutateAsync({
        childId: selectedPayment.childId,
        totalAmount: -totalCorrection,
        channel,
        valueDate,
        referenceNote: referenceNote.trim(),
        correctsPaymentId: selectedPaymentId,
        allocations: correctionAllocations,
      });
      setResultReceiptNumber(result.receiptNumber);
      setSuccess(true);
    } catch {
      // Error handled by React Query
    }
  }

  // ─── Payment options ─────────────────────────────────────────────────────

  const paymentOptions = React.useMemo(() => {
    return originalPayments.map((p: PaymentRecord) => ({
      value: p.id,
      label: `${p.receiptNumber} — ${formatDZD(Number(p.totalAmount), i18n.language)}${p.child ? ` (${p.child.firstName} ${p.child.lastName})` : ''}`,
    }));
  }, [originalPayments, i18n.language]);

  const channelOptions = CHANNELS.map((ch) => ({
    value: ch,
    label: t(`payments.correction.channels.${ch}`),
  }));

  // ─── Success state ───────────────────────────────────────────────────────

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                {t('payments.correction.success.title')}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 bg-subtle rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.correction.success.receiptNumber')}
              </span>
              <span
                className="text-body font-medium text-foreground"
                dir="ltr"
              >
                {resultReceiptNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-secondary">
                {t('payments.correction.success.totalCorrected')}
              </span>
              <span className="text-body font-semibold text-danger" dir="ltr">
                -{formatDZD(totalCorrection, i18n.language)}
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

  // ─── Main form ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <Minus className="w-5 h-5 text-danger" />
              {t('payments.correction.title')}
            </span>
          </DialogTitle>
          <DialogDescription>
            {t('payments.correction.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Select original payment */}
          <FormSelect
            label={t('payments.correction.fields.originalPayment')}
            name="selectedPaymentId"
            value={selectedPaymentId}
            onChange={(e) => {
              setSelectedPaymentId(e.target.value);
              if (errors.payment)
                setErrors((p) => ({ ...p, payment: '' }));
            }}
            options={paymentOptions}
            placeholder={t('payments.correction.fields.selectPayment')}
            error={errors.payment}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {/* Channel */}
            <FormSelect
              label={t('payments.correction.fields.channel')}
              name="channel"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as PaymentChannel);
                if (errors.channel)
                  setErrors((p) => ({ ...p, channel: '' }));
              }}
              options={channelOptions}
              error={errors.channel}
            />

            {/* Value Date */}
            <FormField
              label={t('payments.correction.fields.valueDate')}
              htmlFor="correction-value-date"
              error={errors.valueDate}
              required
            >
              <Input
                id="correction-value-date"
                type="date"
                value={valueDate}
                onChange={(e) => {
                  setValueDate(e.target.value);
                  if (errors.valueDate)
                    setErrors((p) => ({ ...p, valueDate: '' }));
                }}
              />
            </FormField>
          </div>

          {/* Reference Note (required for corrections) */}
          <FormField
            label={t('payments.correction.fields.referenceNote')}
            htmlFor="correction-reference-note"
            error={errors.referenceNote}
            required
            helperText={t('payments.correction.fields.referenceNoteHelper')}
          >
            <textarea
              id="correction-reference-note"
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-body text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:shadow-focus-ring resize-none min-h-[80px]"
              value={referenceNote}
              onChange={(e) => {
                setReferenceNote(e.target.value);
                if (errors.referenceNote)
                  setErrors((p) => ({ ...p, referenceNote: '' }));
              }}
              maxLength={500}
              placeholder={t(
                'payments.correction.fields.referenceNotePlaceholder'
              )}
              aria-invalid={!!errors.referenceNote}
            />
          </FormField>

          {/* Allocations Section */}
          {selectedPayment && allocations.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-label font-medium text-foreground">
                  {t('payments.correction.allocations.title')}
                </h3>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-subtle text-caption font-medium text-text-secondary">
                  <span>
                    {t('payments.correction.allocations.period')}
                  </span>
                  <span className="text-end">
                    {t('payments.correction.allocations.originalAmount')}
                  </span>
                  <span className="text-end">
                    {t('payments.correction.allocations.remaining')}
                  </span>
                  <span className="text-end">
                    {t('payments.correction.allocations.correctionAmount')}
                  </span>
                </div>

                {/* Rows */}
                {allocations.map((alloc, index) => {
                  const enteredVal = Number(alloc.correctionAmount) || 0;
                  const remaining = alloc.remainingCorrectable - enteredVal;

                  return (
                    <div
                      key={alloc.billingPeriodId}
                      className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-border items-center"
                    >
                      <span
                        className="text-body text-foreground truncate"
                        dir="ltr"
                      >
                        {alloc.periodLabel}
                      </span>
                      <span
                        className="text-body text-text-secondary text-end"
                        dir="ltr"
                      >
                        {formatDZD(alloc.originalAmount, i18n.language)}
                      </span>
                      <span
                        className={`text-body text-end ${remaining < 0 ? 'text-danger' : 'text-text-secondary'}`}
                        dir="ltr"
                      >
                        {formatDZD(Math.max(0, remaining), i18n.language)}
                      </span>
                      <div className="flex justify-end">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={alloc.remainingCorrectable}
                          value={alloc.correctionAmount}
                          onChange={(e) =>
                            handleAllocationChange(index, e.target.value)
                          }
                          className="w-28 text-end"
                          placeholder="0.00"
                          aria-label={`${t('payments.correction.allocations.correctionAmount')} - ${alloc.periodLabel}`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Total row */}
                <div className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-border bg-subtle font-medium">
                  <span className="text-body text-foreground col-span-3">
                    {t('payments.correction.allocations.total')}
                  </span>
                  <span
                    className="text-body text-danger text-end"
                    dir="ltr"
                  >
                    -{formatDZD(totalCorrection, i18n.language)}
                  </span>
                </div>
              </div>

              {errors.allocations && (
                <div
                  className="flex items-center gap-2 text-caption text-danger"
                  role="alert"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {errors.allocations}
                </div>
              )}
            </div>
          )}

          {/* Empty state when no payment selected */}
          {!selectedPaymentId && (
            <div className="mt-4 p-4 border border-border border-dashed rounded-lg text-center">
              <p className="text-body text-text-secondary">
                {t('payments.correction.selectPaymentPrompt')}
              </p>
            </div>
          )}

          {/* Loading state for payment details */}
          {selectedPaymentId && !selectedPayment && (
            <div className="mt-4 p-4 border border-border rounded-lg">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-hover rounded w-3/4" />
                <div className="h-4 bg-hover rounded w-1/2" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                recordCorrection.isPending ||
                !selectedPaymentId ||
                totalCorrection <= 0
              }
            >
              {recordCorrection.isPending
                ? t('common.loading')
                : t('payments.correction.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
