import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used within a Dialog');
  return ctx;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  /** A panel on the side of the screen (the whole screen on a phone): what is behind stays in view. */
  side?: boolean;
}

export function DialogContent({ children, className, side = false }: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext();
  const { t } = useTranslation();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Trap focus and handle escape key
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    // A dialog opened over another one (a confirmation) must not unlock the
    // page scroll under the first when it closes.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    // The layer scrolls when the panel (or a popup inside it, like a date
    // picker) is taller than the window, instead of running off-screen.
    // No margin: a page's own spacing between blocks must not push the layer down.
    <div className="fixed inset-0 z-50 overflow-y-auto !m-0">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-[2px] animate-fade-in"
        aria-hidden="true"
      />

      {/* Clicks on the empty area around the panel close the dialog */}
      <div
        className={cn('relative flex min-h-full', side ? 'items-stretch justify-end' : 'items-center justify-center p-4')}
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        {/* Panel */}
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative z-50 bg-card p-5 sm:p-6 w-full shadow-level-4',
            side ? 'sm:max-w-[420px] animate-fade-in' : 'rounded-lg max-w-[480px] animate-scale-in',
            className
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-4 end-4"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.closeDialog')}
          >
            <X className="w-4 h-4" />
          </Button>
          {children}
        </div>
      </div>
    </div>
  );
}

export interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  // pe-8 keeps the title clear of the close button.
  return <div className={cn('mb-5 pe-8', className)}>{children}</div>;
}

export interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={cn('text-subsection font-semibold text-text-heading', className)}>
      {children}
    </h2>
  );
}

export interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <p className={cn('text-body text-text-secondary mt-1', className)}>
      {children}
    </p>
  );
}

export interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap justify-end gap-2 mt-6 pt-4 border-t border-subtle',
        className
      )}
    >
      {children}
    </div>
  );
}
