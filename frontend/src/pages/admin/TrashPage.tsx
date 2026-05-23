import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RotateCcw, Building2, Users, Baby, DoorOpen } from 'lucide-react';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import {
  useTrashList,
  useRestoreRecord,
  useHardDeleteRecord,
  type TrashEntityType,
  type TrashItem,
} from '@/hooks/useTrash';

type EntityTab = TrashEntityType;

const ENTITY_TABS: { key: EntityTab; icon: React.ReactNode }[] = [
  { key: 'schools', icon: <Building2 className="w-4 h-4" /> },
  { key: 'users', icon: <Users className="w-4 h-4" /> },
  { key: 'children', icon: <Baby className="w-4 h-4" /> },
  { key: 'classrooms', icon: <DoorOpen className="w-4 h-4" /> },
];

function formatDeletedAt(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getEntityFields(entityType: EntityTab): { key: string; label: string }[] {
  switch (entityType) {
    case 'schools':
      return [
        { key: 'name', label: 'trash.fields.name' },
        { key: 'contactEmail', label: 'trash.fields.email' },
        { key: 'wilaya', label: 'trash.fields.wilaya' },
      ];
    case 'users':
      return [
        { key: 'firstName', label: 'trash.fields.firstName' },
        { key: 'lastName', label: 'trash.fields.lastName' },
        { key: 'email', label: 'trash.fields.email' },
        { key: 'role', label: 'trash.fields.role' },
      ];
    case 'children':
      return [
        { key: 'firstName', label: 'trash.fields.firstName' },
        { key: 'lastName', label: 'trash.fields.lastName' },
        { key: 'dateOfBirth', label: 'trash.fields.dateOfBirth' },
        { key: 'learnerType', label: 'trash.fields.learnerType' },
      ];
    case 'classrooms':
      return [
        { key: 'name', label: 'trash.fields.name' },
        { key: 'level', label: 'trash.fields.level' },
        { key: 'roomNumber', label: 'trash.fields.roomNumber' },
      ];
  }
}

function ConfirmDeleteDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TrashItem | null;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('trash.confirmDelete.title')}</DialogTitle>
          <DialogDescription>
            {t('trash.confirmDelete.description', { name: item?.displayName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-[var(--color-danger-subtle,#FEF2F2)] border border-danger-muted rounded-lg p-4 text-body text-danger">
          {t('trash.confirmDelete.warning')}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            <Trash2 className="w-4 h-4" />
            {isPending ? t('common.loading') : t('trash.permanentDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TrashPage() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<EntityTab>('schools');
  const [page, setPage] = React.useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<TrashItem | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const pageSize = 20;
  const { data, isLoading } = useTrashList(activeTab, page, pageSize);
  const restoreRecord = useRestoreRecord();
  const hardDeleteRecord = useHardDeleteRecord();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleTabChange(tab: EntityTab) {
    setActiveTab(tab);
    setPage(1);
    setActionError(null);
  }

  function handleRestore(item: TrashItem) {
    setActionError(null);
    restoreRecord.mutate(
      { entityType: item.entityType, id: item.id },
      {
        onError: (err) =>
          setActionError(err instanceof Error ? err.message : t('common.error')),
      },
    );
  }

  function handleDeleteClick(item: TrashItem) {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  }

  function handleConfirmDelete() {
    if (!selectedItem) return;
    setActionError(null);
    hardDeleteRecord.mutate(
      { entityType: selectedItem.entityType, id: selectedItem.id },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedItem(null);
        },
        onError: (err) => {
          setDeleteDialogOpen(false);
          setSelectedItem(null);
          setActionError(err instanceof Error ? err.message : t('common.error'));
        },
      },
    );
  }

  const entityFields = getEntityFields(activeTab);

  const columns: Column<TrashItem>[] = [
    {
      key: 'displayName',
      header: t('trash.columns.name'),
      render: (item) => (
        <span className="text-body font-medium text-foreground">
          {item.displayName}
        </span>
      ),
    },
    ...entityFields.map((field) => ({
      key: field.key,
      header: t(field.label),
      render: (item: TrashItem) => {
        const value = item.metadata[field.key];
        return (
          <span className="text-body text-text-secondary">
            {value != null ? String(value) : '—'}
          </span>
        );
      },
    })),
    {
      key: 'deletedAt',
      header: t('trash.columns.deletedAt'),
      render: (item) => (
        <span className="text-caption text-text-secondary">
          {formatDeletedAt(item.deletedAt, i18n.language)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(item);
            }}
            disabled={restoreRecord.isPending}
            aria-label={t('trash.restore')}
            title={t('trash.restore')}
          >
            <RotateCcw className="w-3.5 h-3.5 text-success" />
            {t('trash.restore')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(item);
            }}
            disabled={hardDeleteRecord.isPending}
            aria-label={t('trash.permanentDelete')}
            title={t('trash.permanentDelete')}
          >
            <Trash2 className="w-3.5 h-3.5 text-danger" />
            {t('trash.permanentDelete')}
          </Button>
        </div>
      ),
      className: 'w-64',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-page-title font-semibold text-text-heading">
        {t('trash.title')}
      </h1>

      {/* Entity type tabs */}
      <div className="flex items-center gap-2">
        {ENTITY_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.icon}
            {t(`trash.tabs.${tab.key}`)}
          </Button>
        ))}
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-body text-danger flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-danger hover:opacity-70 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-hover rounded-md" />
            ))}
          </div>
        </div>
      ) : (
        <DataTable<TrashItem>
          columns={columns}
          data={items}
          keyExtractor={(item) => item.id}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyMessage={t('trash.empty')}
        />
      )}

      {/* Confirm permanent delete dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        item={selectedItem}
        onConfirm={handleConfirmDelete}
        isPending={hardDeleteRecord.isPending}
      />
    </div>
  );
}
