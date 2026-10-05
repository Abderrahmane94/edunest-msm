import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { retryAction, discardAction, type QueuedAction } from '@/lib/offlineQueue';
import type { MessagePayload } from '@/hooks/useMessageSync';

/**
 * An outgoing message not sent yet: waiting for the connection (or being
 * sent), or refused by the server — then it can be sent again or deleted.
 */
export function PendingMessageBubble({ action, syncing }: { action: QueuedAction<MessagePayload>; syncing: boolean }) {
  const { t } = useTranslation();
  const failed = !!action.error;

  return (
    <div className="flex flex-col max-w-[75%] ms-auto items-end">
      <div
        className={
          failed
            ? 'px-3.5 py-2.5 text-body rounded-2xl rounded-ee-sm border border-danger/40 bg-danger-muted text-text-primary'
            : 'px-3.5 py-2.5 text-body rounded-2xl rounded-ee-sm bg-[var(--color-accent)] text-[var(--color-text-inverse)] opacity-70'
        }
      >
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]" dir="auto">
          {action.payload.content}
        </p>
      </div>
      {failed ? (
        <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-micro">
          <span className="inline-flex items-center gap-1 text-danger">
            <AlertCircle className="w-3 h-3" />
            {t('messages.notSent')}
          </span>
          <button
            type="button"
            onClick={() => retryAction(action.id)}
            className="inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            {t('messages.retry')}
          </button>
          <button
            type="button"
            onClick={() => discardAction(action.id)}
            className="inline-flex items-center gap-1 font-medium text-text-secondary hover:underline"
          >
            <Trash2 className="w-3 h-3" />
            {t('messages.delete')}
          </button>
        </div>
      ) : (
        <span className="mt-1 inline-flex items-center gap-1 text-micro text-text-secondary">
          <Clock className="w-3 h-3" />
          {syncing ? t('messages.sending') : t('messages.waiting')}
        </span>
      )}
    </div>
  );
}
