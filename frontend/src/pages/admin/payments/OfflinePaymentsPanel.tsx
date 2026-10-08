import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Receipt, Pencil, Trash2, Eye, X, AlertCircle, ListChecks } from 'lucide-react';
import { Button, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatDate, formatDZD } from '@/lib/formatters';
import { useOnline } from '@/lib/online';
import { discardAction, dismissNotice, type QueuedAction } from '@/lib/offlineQueue';
import {
  useQueuedPayments,
  provisionalRef,
  paymentRefusalText,
  NEEDS_ALLOCATION,
  type OfflinePaymentPayload,
} from '@/hooks/useOfflinePayments';

/**
 * Payments recorded on this device and not yet on the server: waiting to be
 * sent, to allocate (recorded without échéances) or to correct (refused by
 * the server) — and those just sent, with their official receipt number.
 */
export function OfflinePaymentsPanel({
  onFix,
  onShowProvisional,
  onShowReceipt,
}: {
  onFix: (action: QueuedAction<OfflinePaymentPayload>) => void;
  onShowProvisional: (payment: OfflinePaymentPayload) => void;
  onShowReceipt: (paymentId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const { queued, sent, syncing } = useQueuedPayments();
  const [confirmingDelete, setConfirmingDelete] = React.useState<string | null>(null);

  if (queued.length === 0 && sent.length === 0) return null;
  const money = (amount: number) => formatDZD(amount, i18n.language);

  return (
    <section className="bg-card border border-warning/40 rounded-lg p-4 space-y-3">
      <div>
        <h3 className="text-label font-semibold text-foreground flex items-center gap-2">
          <CloudUpload className="w-4 h-4 text-warning" />
          {t('payments.offline.panel.title')}
        </h3>
        <p className="text-caption text-text-secondary mt-0.5">{t('payments.offline.panel.description')}</p>
      </div>

      <ul className="divide-y divide-border">
        {queued.map((action) => {
          const p = action.payload;
          const toAllocate = action.error === NEEDS_ALLOCATION;
          const status = !action.error
            ? syncing && online
              ? 'sending'
              : 'pending'
            : toAllocate
              ? 'toAllocate'
              : 'toFix';
          return (
            <li key={action.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-foreground truncate">
                  {p.childName} · {money(p.totalAmount)}
                </p>
                <p className="text-caption text-text-secondary">
                  <bdi dir="ltr" className="font-mono">{provisionalRef(p)}</bdi> · <bdi dir="ltr">{formatDate(p.valueDate)}</bdi> ·{' '}
                  {t(`payments.recording.channels.${p.channel}`)}
                </p>
                <span
                  className={cn(
                    'mt-1 inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full',
                    status === 'toFix'
                      ? 'bg-danger/10 text-danger'
                      : status === 'toAllocate'
                        ? 'bg-warning/15 text-foreground'
                        : 'bg-subtle text-text-secondary',
                  )}
                >
                  {status === 'toFix' ? <AlertCircle className="w-3 h-3" /> : status === 'toAllocate' ? <ListChecks className="w-3 h-3" /> : null}
                  {t(`payments.offline.status.${status}`)}
                </span>
                {action.error && !toAllocate && (
                  <p className="text-caption text-danger mt-1">{paymentRefusalText(t, action.error)}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {confirmingDelete === action.id ? (
                  <>
                    <span className="text-caption text-text-secondary">{t('payments.offline.panel.confirmDelete')}</span>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        discardAction(action.id);
                        setConfirmingDelete(null);
                      }}
                    >
                      {t('payments.offline.actions.delete')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => onShowProvisional(p)}>
                      <Receipt className="w-4 h-4" />
                      {t('payments.offline.actions.provisionalReceipt')}
                    </Button>
                    {action.error && (
                      <Button
                        size="sm"
                        onClick={() => onFix(action)}
                        disabled={!online}
                        title={online ? undefined : t('payments.offline.panel.needsOnline')}
                      >
                        <Pencil className="w-4 h-4" />
                        {t(toAllocate ? 'payments.offline.actions.allocate' : 'payments.offline.actions.fix')}
                      </Button>
                    )}
                    {action.error && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDelete(action.id)}
                        aria-label={t('payments.offline.actions.delete')}
                        title={t('payments.offline.actions.delete')}
                      >
                        <Trash2 className="w-4 h-4 text-danger" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}

        {sent.map((notice) => (
          <li key={notice.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-body font-medium text-foreground truncate">
                {notice.data.childName} · {money(notice.data.totalAmount)}
              </p>
              <p className="text-caption text-text-secondary">
                <bdi dir="ltr" className="font-mono">{notice.data.provisionalRef}</bdi> →{' '}
                {t('payments.offline.panel.officialReceipt')}{' '}
                <bdi dir="ltr" className="font-mono font-semibold text-foreground">{notice.data.receiptNumber}</bdi>
              </p>
              <StatusBadge variant="success" className="mt-1">
                {t('payments.offline.status.sent')}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => onShowReceipt(notice.data.paymentId)} disabled={!online}>
                <Eye className="w-4 h-4" />
                {t('payments.receipt.viewReceipt')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissNotice(notice.id)}
                aria-label={t('payments.offline.actions.dismiss')}
                title={t('payments.offline.actions.dismiss')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
