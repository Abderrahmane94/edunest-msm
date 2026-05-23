import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from './Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';

/* ─── Types ─── */

type EntityType = 'schools' | 'users' | 'children' | 'classrooms';

export interface EntityDeleteButtonProps {
  /** Plural entity type matching API route segment */
  entityType: EntityType;
  /** UUID of the entity to delete */
  entityId: string;
  /** Human-readable name shown in confirmation dialog */
  entityDisplayName: string;
  /** Called after successful deletion — typically navigates to list page */
  onDeleted: () => void;
  /** If true, the button is not rendered (e.g., entity already deleted) */
  hidden?: boolean;
}

/* ─── Query key map ─── */

const ENTITY_QUERY_KEYS: Record<EntityType, string[]> = {
  schools: ['schools-list'],
  users: ['users'],
  children: ['children'],
  classrooms: ['classrooms'],
};

/* ─── Internal hook ─── */

function useSoftDelete(entityType: EntityType) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await apiClient.delete(`/${entityType}/${entityId}`);
      if (!res.success) {
        const err = new Error(res.error?.message ?? 'Delete failed');
        (err as Error & { code?: string }).code = res.error?.code;
        throw err;
      }
      return res.data;
    },
    onSuccess: () => {
      // Invalidate list queries for this entity type
      queryClient.invalidateQueries({ queryKey: ENTITY_QUERY_KEYS[entityType] });
      // Also invalidate trash queries so trash view updates
      queryClient.invalidateQueries({ queryKey: ['trash', entityType] });
    },
  });

  return { mutation, queryClient };
}

/* ─── Component ─── */

export function EntityDeleteButton({
  entityType,
  entityId,
  entityDisplayName,
  onDeleted,
  hidden,
}: EntityDeleteButtonProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { mutation, queryClient } = useSoftDelete(entityType);

  // Don't render if hidden or entityId is empty
  if (hidden || !entityId) return null;

  const localizedEntityType = t(`common.entityTypes.${entityType}`);

  function handleOpenDialog() {
    // Clear error state when dialog is re-opened for a new attempt
    setError(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    // Block closing while mutation is pending
    if (mutation.isPending) return;
    if (!open) {
      setDialogOpen(false);
    }
  }

  async function handleConfirm() {
    // Clear previous error before new attempt
    setError(null);

    try {
      await mutation.mutateAsync(entityId);
      // Success: close dialog and invoke navigation callback
      setDialogOpen(false);
      onDeleted();
    } catch (err) {
      const caughtError = err as Error & { code?: string };

      // Handle 409 ALREADY_DELETED specially
      if (caughtError.code === 'ALREADY_DELETED') {
        setDialogOpen(false);
        // Invalidate entity query to refresh state
        queryClient.invalidateQueries({ queryKey: ENTITY_QUERY_KEYS[entityType] });
        queryClient.invalidateQueries({ queryKey: ['trash', entityType] });
        onDeleted();
        return;
      }

      // For all other errors: display inline in dialog
      setError(caughtError.message || t('common.softDelete.errorGeneric'));
    }
  }

  return (
    <>
      <Button
        variant="danger"
        onClick={handleOpenDialog}
      >
        <Trash2 className="w-4 h-4" />
        {t('common.softDelete.button')}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.softDelete.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('common.softDelete.dialogWarning', {
                entityType: localizedEntityType,
                entityName: entityDisplayName,
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Inline error display — danger alert card above footer */}
          {error && (
            <div
              role="alert"
              className="rounded-md border border-danger-muted border-s-[3px] border-s-danger bg-[var(--color-danger-subtle)] p-3 mt-2"
            >
              <p className="text-body text-danger">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => handleDialogOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('common.softDelete.dialogCancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirm}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.softDelete.dialogConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
