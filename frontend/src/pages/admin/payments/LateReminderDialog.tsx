import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
} from '@/components/ui';
import { ApiRequestError } from '@/lib/api-client';
import { formatDateTime, formatDZD } from '@/lib/formatters';
import { useSendLateReminder, type LateDashboardEntry } from '@/hooks/useLateDashboard';

/**
 * Confirms, then sends, a payment reminder to a late period's parents:
 * push and email to each, SMS to the primary parent. Confirmation matters
 * because SMS costs money and parents shouldn't be chased twice.
 */
export function LateReminderDialog({
  entry,
  feeLabel,
  daysLate,
  onOpenChange,
}: {
  /** The row to remind about; null closes the dialog. */
  entry: LateDashboardEntry | null;
  feeLabel: string;
  daysLate: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const sendReminder = useSendLateReminder();
  const [sentTo, setSentTo] = React.useState<number | null>(null);

  // Start fresh for each row.
  React.useEffect(() => {
    setSentTo(null);
    sendReminder.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  function errorMessage(err: unknown): string {
    const code = err instanceof ApiRequestError ? err.code : '';
    switch (code) {
      case 'ALREADY_REMINDED':
        return t('payments.late.reminder.errors.alreadyReminded');
      case 'NO_PARENTS':
        return t('payments.late.reminder.errors.noParents');
      case 'NOT_LATE':
        return t('payments.late.reminder.errors.notLate');
      default:
        return t('payments.late.reminder.errors.failed');
    }
  }

  async function handleSend() {
    if (!entry) return;
    try {
      const result = await sendReminder.mutateAsync(entry.id);
      setSentTo(result.sentTo);
    } catch {
      // Shown from sendReminder.error.
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payments.late.reminder.title')}</DialogTitle>
          <DialogDescription>{t('payments.late.reminder.description')}</DialogDescription>
        </DialogHeader>

        {entry && (
          sentTo !== null ? (
            <div className="flex items-start gap-3 rounded-lg bg-success-muted p-4">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <p className="text-body text-success">{t('payments.late.reminder.sent', { count: sentTo })}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <dl className="rounded-lg bg-subtle p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
                <dt className="text-text-secondary">{t('payments.late.columns.childName')}</dt>
                <dd className="font-medium text-foreground">{entry.childName}</dd>
                <dt className="text-text-secondary">{t('payments.late.columns.fee')}</dt>
                <dd className="text-foreground">
                  {feeLabel} · <bdi dir="ltr">{entry.periodLabel}</bdi>
                </dd>
                <dt className="text-text-secondary">{t('payments.late.columns.outstanding')}</dt>
                <dd className="font-semibold text-danger">
                  <bdi dir="ltr">{formatDZD(Number(entry.outstanding), i18n.language)}</bdi>
                  <span className="text-caption font-normal ms-2">{t('payments.late.daysLate', { count: daysLate })}</span>
                </dd>
              </dl>

              <p className="text-caption text-text-secondary">{t('payments.late.reminder.channels')}</p>

              {entry.lastReminderAt && (
                <p className="text-caption text-warning">
                  {t('payments.late.reminder.lastSent', { date: formatDateTime(entry.lastReminderAt, i18n.language) })}
                </p>
              )}

              {sendReminder.error && <ErrorAlert message={errorMessage(sendReminder.error)} />}
            </div>
          )
        )}

        <DialogFooter>
          {sentTo !== null ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={handleSend} disabled={sendReminder.isPending}>
                <BellRing className="w-4 h-4" />
                {sendReminder.isPending ? t('payments.late.reminder.sending') : t('payments.late.reminder.send')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
