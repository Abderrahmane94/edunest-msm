import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/**
 * A detail page opens to read, and the user presses "Modifier" to change it.
 * `cancelEditing` puts the saved values back (through `reset`) before leaving
 * edit mode, so nothing half-typed stays on screen.
 *
 *   const edit = useEditMode(() => setFormData(toForm(user)));
 *   <EditButton onClick={edit.startEditing} hidden={edit.editing} />
 *   <ReadOnlyFieldset readOnly={!edit.editing}>…fields…</ReadOnlyFieldset>
 *   {edit.editing && <EditFormActions saving={…} onCancel={edit.cancelEditing} />}
 */
export function useEditMode(reset: () => void) {
  const [editing, setEditing] = React.useState(false);
  const resetRef = React.useRef(reset);
  resetRef.current = reset;

  return {
    editing,
    startEditing: React.useCallback(() => setEditing(true), []),
    /** After a successful save. */
    finishEditing: React.useCallback(() => setEditing(false), []),
    cancelEditing: React.useCallback(() => {
      resetRef.current();
      setEditing(false);
    }, []),
  };
}

/**
 * Wraps a form's fields. Read-only, the fields are disabled and drawn as
 * plain text under their labels (see `.read-mode` in globals.css).
 */
export function ReadOnlyFieldset({
  readOnly,
  className,
  children,
}: {
  readOnly: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset disabled={readOnly} className={cn('min-w-0', readOnly && 'read-mode', className)}>
      {children}
    </fieldset>
  );
}

/** "Modifier": switches a detail page from reading to editing. */
export function EditButton({ onClick, hidden, className }: { onClick: () => void; hidden?: boolean; className?: string }) {
  const { t } = useTranslation();
  if (hidden) return null;
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} className={className}>
      <Pencil className="w-4 h-4" />
      {t('common.edit')}
    </Button>
  );
}

/** "Enregistrer" (submits the form) and "Annuler" (back to reading, changes dropped). */
export function EditFormActions({
  saving,
  onCancel,
  saveLabel,
}: {
  saving?: boolean;
  onCancel: () => void;
  saveLabel?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Button type="submit" disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? t('common.loading') : saveLabel ?? t('common.save')}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
        <X className="w-4 h-4" />
        {t('common.cancel')}
      </Button>
    </>
  );
}
