import * as React from 'react';
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
                    {labels.feeName}
                  </th>
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
                      {alloc.feeName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-body text-text-secondary" dir="ltr">
                      {alloc.periodLabel}
                    </td>
                    <td className="px-4 py-2.5 text-body text-foreground text-end" dir="ltr">
                      {alloc.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-subtle">
                  <td colSpan={2} className="px-4 py-2.5 text-body font-medium text-foreground">
                    {labels.amount}
                  </td>
                  <td className="px-4 py-2.5 text-body font-semibold text-foreground text-end" dir="ltr">
                    {receipt.amount}
                  </td>
                </tr>
              </tfoot>
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

// ─── Print helpers ─────────────────────────────────────────────────────────────

/** e.g. "Reçu MAI-2026-000012 - Yasmine Boudiaf" — used as the PDF file name. */
function receiptFileName(receipt: ReceiptData): string {
  const prefix = receipt.language === 'ar' ? 'إيصال' : 'Reçu';
  // Characters not allowed in file names on common systems.
  return `${prefix} ${receipt.receiptNumber} - ${receipt.childName}`.replace(/[\\/:*?"<>|]/g, '-');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
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

  const contentRef = React.useRef<HTMLDivElement>(null);

  // Prints the receipt alone from a hidden frame: printing the page itself
  // came out blank (the dialog lives in a portal the print styles hide).
  // The frame's title is the default file name when saving as PDF.
  function handlePrint() {
    const node = contentRef.current;
    if (!receipt || !node) return;

    const fileName = receiptFileName(receipt);
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('');
    const html =
      `<!doctype html><html lang="${receipt.language}" dir="${receipt.direction}" ` +
      `class="${document.documentElement.className}"><head><meta charset="utf-8">` +
      `<base href="${document.baseURI}"><title>${escapeHtml(fileName)}</title>${styles}` +
      `<style>@page{margin:12mm}body{background:#fff}</style></head>` +
      `<body><div class="receipt-print-root">${node.innerHTML}</div></body></html>`;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });

    // Some browsers name the PDF after the top page's title, so set it too.
    const previousTitle = document.title;
    const cleanup = () => {
      document.title = previousTitle;
      frame.remove();
    };

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return cleanup();
      win.addEventListener('afterprint', cleanup);
      document.title = fileName;
      win.focus();
      win.print();
      // Fallback for browsers that don't fire afterprint on the frame.
      setTimeout(cleanup, 60_000);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
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
        {receipt && !isLoading && (
          <div ref={contentRef}>
            <ReceiptContent receipt={receipt} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
