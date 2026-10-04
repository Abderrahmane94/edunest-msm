import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Mail, Send, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@/components/ui';
import { useReceipt, useEmailReceipt, type ReceiptData } from '@/hooks/usePayments';
import { Input } from '@/components/ui/Input';
import { receiptToPdfBase64, downloadReceiptPdf } from '@/lib/receiptPdf';
import { ReceiptDocument } from './ReceiptDocument';

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

  // The receipt document: on-screen preview, print and PDF all come from it.
  const contentRef = React.useRef<HTMLDivElement>(null);

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
      // A4 page with margins; the on-screen "paper" frame isn't printed.
      `<style>@page{size:A4;margin:12mm}body{background:#fff;margin:0}` +
      `.receipt-document{border:none!important;box-shadow:none!important;border-radius:0!important}` +
      `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>` +
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

        {/* The receipt document (also what gets printed and attached) */}
        {receipt && !isLoading && (
          <div className="rounded-lg bg-subtle p-3 overflow-x-auto">
            <div ref={contentRef} className="min-w-[600px]">
              <ReceiptDocument receipt={receipt} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
