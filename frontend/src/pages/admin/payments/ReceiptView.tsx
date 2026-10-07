import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Mail, Send, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@/components/ui';
import { useReceipt, useEmailReceipt, type ReceiptData } from '@/hooks/usePayments';
import { Input } from '@/components/ui/Input';
import { receiptToPdfBase64, downloadReceiptPdf } from '@/lib/receiptPdf';
import { printDocument } from '@/lib/printDocument';
import { ReceiptDocument } from './ReceiptDocument';

// ─── Print helpers ─────────────────────────────────────────────────────────────

/** e.g. "Reçu MAI-2026-000012 - Yasmine Boudiaf" — used as the PDF file name. */
function receiptFileName(receipt: ReceiptData): string {
  const prefix = receipt.language === 'ar' ? 'إيصال' : 'Reçu';
  // Characters not allowed in file names on common systems.
  return `${prefix} ${receipt.receiptNumber} - ${receipt.childName}`.replace(/[\\/:*?"<>|]/g, '-');
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
  const { data: receipt, isLoading, error } = useReceipt(open ? paymentRecordId : null, language);

  // Print and PDF come from a hidden copy in the full (A4) layout, so they're
  // the same on every screen; the preview below adapts to narrow screens.
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 560));
    observer.observe(node);
    return () => observer.disconnect();
  }, [receipt]);

  // ─── Send by email ───
  const emailReceipt = useEmailReceipt();
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [emailTo, setEmailTo] = React.useState('');
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [sentWithoutPdf, setSentWithoutPdf] = React.useState(false);
  const [preparingPdf, setPreparingPdf] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  // Start fresh each time the dialog opens on a receipt.
  React.useEffect(() => {
    setEmailOpen(false);
    setSentTo(null);
    emailReceipt.reset();
  }, [open, paymentRecordId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setEmailTo(receipt?.emailRecipient ?? '');
  }, [receipt?.emailRecipient]);

  async function handleSendEmail() {
    if (!paymentRecordId || !receipt) return;
    setSentTo(null);

    // The PDF is a bonus on top of the receipt in the email body: if it can't
    // be rendered, still send the email.
    let pdfBase64: string | undefined;
    if (contentRef.current) {
      setPreparingPdf(true);
      try {
        pdfBase64 = await receiptToPdfBase64(contentRef.current);
      } catch {
        pdfBase64 = undefined;
      } finally {
        setPreparingPdf(false);
      }
    }

    try {
      const address = await emailReceipt.mutateAsync({
        paymentRecordId,
        to: receipt.canChooseRecipient ? emailTo.trim() : undefined,
        language,
        pdfBase64,
        pdfFileName: pdfBase64 ? receiptFileName(receipt) : undefined,
      });
      setSentWithoutPdf(!pdfBase64);
      setSentTo(address);
    } catch {
      // Shown from emailReceipt.error below.
    }
  }

  async function handleDownloadPdf() {
    if (!receipt || !contentRef.current) return;
    setDownloading(true);
    try {
      await downloadReceiptPdf(contentRef.current, receiptFileName(receipt));
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    const node = contentRef.current;
    if (!receipt || !node) return;
    printDocument(node, {
      fileName: receiptFileName(receipt),
      language: receipt.language,
      direction: receipt.direction,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t('payments.receipt.title')}</DialogTitle>
        </DialogHeader>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          <Button
            variant={emailOpen ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setEmailOpen((v) => !v)}
            disabled={!receipt}
            aria-expanded={emailOpen}
          >
            <Mail className="w-4 h-4" />
            {t('payments.receipt.sendEmail')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!receipt}>
            <Printer className="w-4 h-4" />
            {t('payments.receipt.print')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={!receipt || downloading}
          >
            <Download className="w-4 h-4" />
            {downloading ? t('common.loading') : t('payments.receipt.downloadPdf')}
          </Button>
        </div>

        {/* Send by email */}
        {emailOpen && receipt && (
          <div className="rounded-lg border border-border bg-subtle p-3 space-y-2 mb-4">
            {receipt.canChooseRecipient ? (
              <Input
                type="email"
                label={t('payments.receipt.emailTo')}
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="parent@example.dz"
                helperText={receipt.emailRecipient ? undefined : t('payments.receipt.emailNoParent')}
              />
            ) : (
              <p className="text-caption text-text-secondary">
                {receipt.emailRecipient
                  ? t('payments.receipt.emailWillSendTo', { email: receipt.emailRecipient })
                  : t('payments.receipt.emailNoAddress')}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {sentTo && (
                <p className="text-caption text-success me-auto" role="status">
                  {t(sentWithoutPdf ? 'payments.receipt.emailSentNoPdf' : 'payments.receipt.emailSent', {
                    email: sentTo,
                  })}
                </p>
              )}
              {emailReceipt.isError && (
                <p className="text-caption text-danger me-auto" role="alert">
                  {emailReceipt.error instanceof Error ? emailReceipt.error.message : t('common.error')}
                </p>
              )}
              <Button
                size="sm"
                onClick={() => void handleSendEmail()}
                disabled={
                  preparingPdf ||
                  emailReceipt.isPending ||
                  (receipt.canChooseRecipient ? !emailTo.trim() : !receipt.emailRecipient)
                }
              >
                <Send className="w-4 h-4" />
                {preparingPdf || emailReceipt.isPending ? t('common.loading') : t('payments.receipt.emailSend')}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="py-12">
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
          <div className="py-8 text-center text-danger">
            <p className="text-body">{t('payments.receipt.error')}</p>
          </div>
        )}

        {/* The receipt document */}
        {receipt && !isLoading && (
          <>
            <div ref={previewRef} className="rounded-lg bg-subtle p-2 sm:p-3">
              <ReceiptDocument receipt={receipt} compact={compact} />
            </div>
            {/* What gets printed and attached: always the full layout. Never
                displayed — print and PDF render their own copy of its markup. */}
            <div className="hidden" aria-hidden="true">
              <div ref={contentRef}>
                <ReceiptDocument receipt={receipt} />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
