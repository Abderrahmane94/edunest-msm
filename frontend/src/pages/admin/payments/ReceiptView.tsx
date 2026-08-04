import { useTranslation } from 'react-i18next';
import { Printer, X, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui';
import { useReceipt, type ReceiptData } from '@/hooks/usePayments';

// ─── Receipt Content (rendered both in dialog and for print) ───────────────────

interface ReceiptContentProps {
  receipt: ReceiptData;
}

function ReceiptContent({ receipt }: ReceiptContentProps) {
  const { labels, direction } = receipt;

  return (
    <div
      className="receipt-content space-y-6 p-6"
      dir={direction}
    >
      {/* Header / Title */}
      <div className="text-center border-b border-border pb-4">
        <h2 className="text-h2 font-semibold text-text-heading">
          {receipt.title}
        </h2>
        {receipt.isCorrection && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-danger/10 text-danger rounded-md text-caption">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{labels.correctionReceiptTitle}</span>
          </div>
        )}
      </div>

      {/* School & Branch info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReceiptField label={labels.schoolName} value={receipt.schoolName} />
        <ReceiptField label={labels.branchName} value={receipt.branchName} />
      </div>

      {/* Receipt details */}
      <div className="bg-subtle rounded-lg p-4 space-y-3">
        <ReceiptField
          label={labels.receiptNumber}
          value={receipt.receiptNumber}
          dir="ltr"
          mono
        />
        <ReceiptField label={labels.childName} value={receipt.childName} />
        <ReceiptField
          label={labels.amount}
          value={receipt.amount}
          dir="ltr"
          highlight={receipt.isCorrection}
        />
        <ReceiptField label={labels.channel} value={receipt.channel} />
        <ReceiptField label={labels.valueDate} value={receipt.valueDate} dir="ltr" />
        <ReceiptField label={labels.recordedBy} value={receipt.recordedBy} />
      </div>

      {/* Correction-specific info (when this IS a correction) */}
      {receipt.isCorrection && receipt.correctsReceiptNumber && (
        <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 space-y-2">
          <ReceiptField
            label={labels.correctsReceipt}
            value={receipt.correctsReceiptNumber}
            dir="ltr"
            mono
          />
          {receipt.correctionReason && (
            <ReceiptField
              label={labels.correctionReason}
              value={receipt.correctionReason}
            />
          )}
        </div>
      )}

      {/* Allocated billing periods */}
      {receipt.allocations.length > 0 && (
        <div>
          <h3 className="text-label font-medium text-text-heading mb-3">
            {labels.allocatedPeriods}
          </h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-subtle">
                  <th className="px-4 py-2 text-start text-caption font-medium text-text-secondary">
                    {labels.periodLabel}
                  </th>
                  <th className="px-4 py-2 text-end text-caption font-medium text-text-secondary">
                    {labels.periodAmount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipt.allocations.map((alloc, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-border"
                  >
                    <td className="px-4 py-2.5 text-body text-foreground">
                      {alloc.periodLabel}
                    </td>
                    <td className="px-4 py-2.5 text-body text-foreground text-end" dir="ltr">
                      {alloc.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correction markers (when this record HAS BEEN corrected) */}
      {receipt.isCorrepted && receipt.corrections.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
          <h3 className="text-label font-medium text-warning mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {labels.correctionMarker}
          </h3>
          <div className="space-y-2">
            {receipt.corrections.map((correction, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-body text-text-secondary"
              >
                <span dir="ltr" className="font-mono text-caption">
                  {correction.receiptNumber}
                </span>
                <span dir="ltr">{correction.valueDate}</span>
                <span dir="ltr" className="text-danger font-medium">
                  {correction.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────────────────────

function ReceiptField({
  label,
  value,
  dir,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-body text-text-secondary shrink-0">{label}</span>
      <span
        className={`text-body text-foreground ${mono ? 'font-mono' : ''} ${highlight ? 'text-danger font-medium' : 'font-medium'}`}
        dir={dir}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Receipt View Dialog ───────────────────────────────────────────────────────

interface ReceiptViewProps {
  paymentRecordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptView({ paymentRecordId, open, onOpenChange }: ReceiptViewProps) {
  const { i18n, t } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'fr';
  const { data: receipt, isLoading, error } = useReceipt(
    open ? paymentRecordId : null,
    language
  );

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none">
        {/* Dialog header (hidden when printing) */}
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between">
            <span>{t('payments.receipt.title')}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrint}
                disabled={!receipt}
              >
                <Printer className="w-4 h-4 me-1" />
                {t('payments.receipt.print')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="py-12 flex justify-center print:hidden">
            <div className="animate-pulse space-y-3 w-full">
              <div className="h-8 bg-hover rounded-md w-48 mx-auto" />
              <div className="h-4 bg-hover rounded-md w-full" />
              <div className="h-4 bg-hover rounded-md w-3/4" />
              <div className="h-4 bg-hover rounded-md w-1/2" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="py-8 text-center text-danger print:hidden">
            <p className="text-body">{t('payments.receipt.error')}</p>
          </div>
        )}

        {/* Receipt content */}
        {receipt && !isLoading && <ReceiptContent receipt={receipt} />}
      </DialogContent>
    </Dialog>
  );
}
