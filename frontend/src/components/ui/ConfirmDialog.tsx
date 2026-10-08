import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog';

export interface ConfirmOptions {
  title: React.ReactNode;
  /** What will happen, in one or two sentences. */
  description?: React.ReactNode;
  /** Label of the confirm button, e.g. "Désactiver". */
  confirmLabel: React.ReactNode;
  /** Label of the button that backs out, when "Annuler" would be ambiguous. */
  cancelLabel?: React.ReactNode;
  /** danger: red button for what removes or cuts access; default: a plain one. */
  tone?: 'danger' | 'default';
}

/**
 * Asks before an action that removes something or cuts someone's access.
 * `confirm()` opens the dialog and resolves to true when the user confirms,
 * false when they cancel or close it. Render `dialog` anywhere in the
 * component; it is drawn over everything, even over another open dialog.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title, description, confirmLabel, tone: 'danger' }))) return;
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: React.ReactNode;
} {
  const [request, setRequest] = React.useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const settle = React.useCallback((ok: boolean) => {
    setRequest((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const dialog = request ? <ConfirmDialogView options={request} onSettle={settle} /> : null;
  return { confirm, dialog };
}

function ConfirmDialogView({ options, onSettle }: { options: ConfirmOptions; onSettle: (ok: boolean) => void }) {
  const { t } = useTranslation();
  const danger = (options.tone ?? 'danger') === 'danger';

  // Escape closes only this dialog, not one open beneath it.
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onSettle(false);
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onSettle]);

  return createPortal(
    <Dialog open onOpenChange={(open) => !open && onSettle(false)}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader className="flex items-start gap-3">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-[var(--color-danger-muted)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
          )}
          <div className="min-w-0">
            <DialogTitle>{options.title}</DialogTitle>
            {options.description && <DialogDescription>{options.description}</DialogDescription>}
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onSettle(false)}>
            {options.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={() => onSettle(true)} autoFocus>
            {options.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
    document.body
  );
}
