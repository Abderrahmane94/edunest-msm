import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** An icon (lucide); a tray by default. */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  message: React.ReactNode;
  /** A button leading to what to do next. */
  action?: React.ReactNode;
  /** Without its own frame (inside a card or a table). */
  bare?: boolean;
  className?: string;
}

/** "Nothing here yet", the same on every page. */
export function EmptyState({ icon, title, message, action, bare, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 px-6 py-10',
        !bare && 'bg-card border border-border rounded-lg',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl rotate-3 bg-gradient-to-br from-[var(--color-accent-muted)] to-[var(--color-pink-muted)] flex items-center justify-center text-primary [&>svg]:w-7 [&>svg]:h-7 [&>svg]:-rotate-3">
        {icon ?? <Inbox />}
      </div>
      <div className="space-y-1 max-w-sm">
        {title && <p className="text-body font-semibold text-text-heading">{title}</p>}
        <p className="text-body text-text-secondary">{message}</p>
      </div>
      {action}
    </div>
  );
}
