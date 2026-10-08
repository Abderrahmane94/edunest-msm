import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { AlertCircle, RotateCw } from 'lucide-react';
import { errorMessage } from '@/lib/errorMessage';

/** A query this page shows that failed and has nothing to show instead. */
function isFailedOnPage(query: Query): boolean {
  return query.state.status === 'error' && query.state.data === undefined && query.getObserversCount() > 0;
}

/**
 * Says when data on the current page couldn't be loaded, with a Retry button.
 * Without it a failed list looks empty ("no children") and a failed count
 * looks like 0. Data kept from an earlier visit (shown offline) isn't a
 * failure; offline, requests wait instead of failing.
 */
export function LoadErrorBanner({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const [retrying, setRetrying] = React.useState(false);

  const subscribe = React.useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  // The first failed query's error (stable between renders while unchanged).
  const failed = React.useSyncExternalStore(subscribe, () => cache.getAll().find(isFailedOnPage)?.state.error ?? null);

  if (!failed) return null;

  async function retry() {
    setRetrying(true);
    try {
      await queryClient.refetchQueries({ predicate: isFailedOnPage });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      role="alert"
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 ${className}`}
    >
      <AlertCircle className="w-5 h-5 text-danger shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <p className="text-body font-medium text-danger">{t('errors.loadFailed')}</p>
        <p className="text-caption text-danger/80">{errorMessage(failed, t)}</p>
      </div>
      <button
        type="button"
        onClick={() => void retry()}
        disabled={retrying}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-danger/30 bg-card text-caption font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
      >
        <RotateCw className={retrying ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
        {t('errors.retry')}
      </button>
    </div>
  );
}
