import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Pencil, Wrench } from 'lucide-react';
import {
  Button,
  CreateButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorAlert,
  Input,
  ListSkeleton,
  SearchInput,
  SectionHeader,
  StatusBadge,
  useConfirm,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { formatDZD } from '@/lib/formatters';
import { useRooms } from '@/hooks/useRooms';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  useDeleteEquipment,
  useEquipment,
  useSaveEquipment,
  type Equipment,
  type EquipmentCategory,
  type EquipmentCondition,
} from '@/hooks/useEquipment';
import { usePermissions } from '@/lib/roles';

const selectClass = 'h-10 rounded-md border border-border bg-card px-2 text-body text-foreground';
const NO_ROOM = 'none';

const CONDITION_BADGE: Record<EquipmentCondition, 'success' | 'warning' | 'overdue'> = {
  good: 'success',
  repair: 'warning',
  broken: 'overdue',
};

/** Adds or edits a piece of equipment. */
function EquipmentDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Equipment | null;
}) {
  const { t } = useTranslation();
  const save = useSaveEquipment();
  const remove = useDeleteEquipment();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: rooms = [] } = useRooms();
  const empty = { name: '', category: 'furniture' as EquipmentCategory, quantity: '1', condition: 'good' as EquipmentCondition, roomId: NO_ROOM, purchaseDate: '', unitValue: '', notes: '' };
  const [form, setForm] = React.useState(empty);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            quantity: String(item.quantity),
            condition: item.condition,
            roomId: item.roomId ?? NO_ROOM,
            purchaseDate: item.purchaseDate?.slice(0, 10) ?? '',
            unitValue: item.unitValue != null ? String(Number(item.unitValue)) : '',
            notes: item.notes ?? '',
          }
        : empty,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  // Rooms put aside stay offered only for what is already in them.
  const roomOptions = rooms.filter((r) => r.is_active || r.id === item?.roomId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError(t('inventory.equipment.quantityInvalid'));
      return;
    }
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        name: form.name.trim(),
        category: form.category,
        quantity,
        condition: form.condition,
        roomId: form.roomId === NO_ROOM ? null : form.roomId,
        purchaseDate: form.purchaseDate || null,
        unitValue: form.unitValue === '' ? null : Number(form.unitValue),
        notes: form.notes.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function handleDelete() {
    if (!item) return;
    const ok = await confirm({
      title: t('inventory.equipment.deleteTitle', { name: item.name }),
      description: t('inventory.equipment.deleteDescription'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(item.id);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        {confirmDialog}
        <DialogHeader>
          <DialogTitle>{item ? t('inventory.equipment.editTitle') : t('inventory.equipment.createTitle')}</DialogTitle>
          <DialogDescription>{t('inventory.equipment.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('inventory.item.name')} htmlFor="eq-name" required>
            <Input id="eq-name" value={form.name} maxLength={120} placeholder={t('inventory.equipment.namePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-x-3">
            <FormField label={t('inventory.item.category')} htmlFor="eq-category" required>
              <select id="eq-category" value={form.category} onChange={(e) => set({ category: e.target.value as EquipmentCategory })} className={selectClass}>
                {EQUIPMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`inventory.equipment.categories.${c}`)}</option>)}
              </select>
            </FormField>
            <FormField label={t('inventory.equipment.quantity')} htmlFor="eq-quantity" required>
              <Input id="eq-quantity" type="number" min={1} step={1} value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <FormField label={t('inventory.equipment.condition')} htmlFor="eq-condition" required>
              <select id="eq-condition" value={form.condition} onChange={(e) => set({ condition: e.target.value as EquipmentCondition })} className={selectClass}>
                {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{t(`inventory.equipment.conditions.${c}`)}</option>)}
              </select>
            </FormField>
            <FormField label={t('inventory.equipment.room')} htmlFor="eq-room">
              <select id="eq-room" value={form.roomId} onChange={(e) => set({ roomId: e.target.value })} className={selectClass}>
                <option value={NO_ROOM}>{t('inventory.equipment.noRoom')}</option>
                {roomOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <FormField label={t('inventory.equipment.purchaseDate')} htmlFor="eq-date">
              <Input id="eq-date" type="date" value={form.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} />
            </FormField>
            <FormField label={t('inventory.equipment.unitValue')} htmlFor="eq-value">
              <Input id="eq-value" type="number" min={0} step="0.01" value={form.unitValue} onChange={(e) => set({ unitValue: e.target.value })} />
            </FormField>
          </div>
          <FormField label={t('inventory.item.notes')} htmlFor="eq-notes">
            <Input id="eq-notes" value={form.notes} maxLength={500} placeholder={t('inventory.equipment.notesPlaceholder')} onChange={(e) => set({ notes: e.target.value })} />
          </FormField>
          <ErrorAlert message={error} />
          <DialogFooter className="flex-wrap gap-2">
            {item && (
              <Button type="button" variant="ghost" size="sm" className="text-danger me-auto" disabled={remove.isPending} onClick={handleDelete}>
                {t('common.delete')}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The school's equipment, room by room. */
export function EquipmentTab() {
  const { t, i18n } = useTranslation();
  const { data: items, isLoading, isError, error } = useEquipment();
  const { data: rooms = [] } = useRooms();
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [condition, setCondition] = React.useState('');
  const [roomFilter, setRoomFilter] = React.useState('');
  const [editing, setEditing] = React.useState<Equipment | null | undefined>(undefined);
  const canEdit = usePermissions().can('inventory', 'edit');

  const all = items ?? [];
  const q = search.trim().toLowerCase();
  const shown = all
    .filter((e) => !category || e.category === category)
    .filter((e) => !condition || e.condition === condition)
    .filter((e) => !roomFilter || (e.roomId ?? NO_ROOM) === roomFilter)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q));

  // Room by room (by name), then what is in no room.
  const groups = [
    ...[...new Map(shown.filter((e) => e.room).map((e) => [e.room!.id, e.room!.name])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ key: id, name, items: shown.filter((e) => e.roomId === id) })),
    { key: NO_ROOM, name: t('inventory.equipment.noRoom'), items: shown.filter((e) => !e.roomId) },
  ].filter((g) => g.items.length > 0);

  const toRepair = all.filter((e) => e.condition === 'repair').reduce((n, e) => n + e.quantity, 0);
  const pieces = shown.reduce((n, e) => n + e.quantity, 0);
  const value = shown.reduce((n, e) => n + (e.unitValue != null ? Number(e.unitValue) * e.quantity : 0), 0);
  const money = (v: number) => formatDZD(v, i18n.language);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('inventory.equipment.title')}
        description={t('inventory.equipment.description')}
        actions={canEdit && <CreateButton label={t('inventory.equipment.create')} onClick={() => setEditing(null)} />}
      />

      {toRepair > 0 && (
        <button
          type="button"
          onClick={() => setCondition('repair')}
          className="w-full text-start flex items-center gap-2 rounded-xl bg-warning-muted px-4 py-2.5 text-body text-foreground"
        >
          <Wrench className="w-4 h-4 text-warning shrink-0" />
          {t('inventory.equipment.toRepairBanner', { count: toRepair })}
        </button>
      )}

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <SearchInput defaultValue={search} onSearch={setSearch} placeholder={t('inventory.equipment.searchPlaceholder')} className="w-full sm:w-64" />
          <select aria-label={t('inventory.equipment.room')} value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className={selectClass}>
            <option value="">{t('inventory.equipment.allRooms')}</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            <option value={NO_ROOM}>{t('inventory.equipment.noRoom')}</option>
          </select>
          <select aria-label={t('inventory.item.category')} value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">{t('inventory.allCategories')}</option>
            {EQUIPMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`inventory.equipment.categories.${c}`)}</option>)}
          </select>
          <select aria-label={t('inventory.equipment.condition')} value={condition} onChange={(e) => setCondition(e.target.value)} className={selectClass}>
            <option value="">{t('inventory.equipment.allConditions')}</option>
            {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{t(`inventory.equipment.conditions.${c}`)}</option>)}
          </select>
        </div>
        <p className="text-caption text-text-secondary">
          {t('inventory.equipment.summary', { count: pieces })}
          {value > 0 && ` · ${t('inventory.equipment.totalValue', { value: money(value) })}`}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : all.length === 0 ? (
        <EmptyState message={t('inventory.equipment.empty')} />
      ) : groups.length === 0 ? (
        <EmptyState message={t('inventory.noMatch')} />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="bg-card border border-border rounded-lg">
            <h3 className="px-4 py-2.5 bg-subtle rounded-t-lg flex items-center gap-2 text-body font-semibold text-foreground">
              <DoorOpen className="w-4 h-4 text-text-secondary" />
              <span className="flex-1">{g.name}</span>
              <span className="text-caption font-normal text-text-secondary">
                {t('inventory.equipment.summary', { count: g.items.reduce((n, e) => n + e.quantity, 0) })}
              </span>
            </h3>
            <ul className="divide-y divide-border">
              {g.items.map((e) => (
                <li key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="w-10 shrink-0 text-body font-semibold tabular-nums text-foreground">×{e.quantity}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-body text-foreground', e.condition === 'broken' && 'line-through text-text-secondary')}>{e.name}</p>
                    <p className="text-caption text-text-secondary truncate">
                      {t(`inventory.equipment.categories.${e.category}`)}
                      {e.unitValue != null && ` · ${money(Number(e.unitValue) * e.quantity)}`}
                      {e.notes && ` · ${e.notes}`}
                    </p>
                  </div>
                  <StatusBadge variant={CONDITION_BADGE[e.condition]}>{t(`inventory.equipment.conditions.${e.condition}`)}</StatusBadge>
                  {canEdit && (
                    <Button variant="ghost" size="sm" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(e)}>
                      <Pencil className="w-4 h-4 text-primary" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <EquipmentDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} item={editing ?? null} />
    </div>
  );
}
