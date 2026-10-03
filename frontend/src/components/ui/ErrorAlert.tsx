import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Red message for an action that failed (usually the server's error text).
 * Renders nothing without a message. Pass `onDismiss` to show a close button.
 */
export function ErrorAlert({
  message,
  onDismiss,
  className,
}: {
  message: string | null | undefined;
  onDismiss?: () => void;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger',
        className,
      )}
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 hover:opacity-70" aria-label="×">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

