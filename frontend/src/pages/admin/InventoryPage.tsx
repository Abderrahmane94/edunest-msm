import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Armchair, ClipboardList, History, Minus, Package, Pencil, ShoppingCart } from 'lucide-react';
import {
  Button,
  CardGrid,
  CreateButton,
  DataTable,
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
  PageHeader,
  SectionHeader,
  Tabs,
  SearchInput,
  StatusBadge,
  ViewToggle,
  useListView,
  type Column,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { formatDate, formatDZD } from '@/lib/formatters';
import { StockMovementDialog, type MovementType } from '@/components/inventory/StockMovementDialog';
import { useTabParam } from '@/hooks/useTabParam';
import { EquipmentTab } from './EquipmentTab';
import {
  STOCK_CATEGORIES,
  qty,
  useCreateStockItem,
  useDeleteStockItem,
  useStockItems,
  useStockMovements,
  useUpdateStockItem,
  type StockCategory,
  type StockItem,
} from '@/hooks/useInventory';
import { usePermissions } from '@/lib/roles';

const UNIT_SUGGESTIONS = ['paquet', 'boîte', 'flacon', 'bidon', 'rouleau', 'pièce', 'litre', 'kg', 'ramette'];

const selectClass = 'h-10 rounded-md border border-border bg-card px-2 text-body text-foreground';

/** Adds or edits a supply. */
function StockItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null: a new supply. */
  item: StockItem | null;
}) {
  const { t } = useTranslation();
  const create = useCreateStockItem();
  const update = useUpdateStockItem();
  const remove = useDeleteStockItem();
  const [form, setForm] = React.useState({ name: '', category: 'hygiene' as StockCategory, unit: '', alertThreshold: '', initialQuantity: '', notes: '' });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? { name: item.name, category: item.category, unit: item.unit, alertThreshold: qty(item.alertThreshold), initialQuantity: '', notes: item.notes ?? '' }
        : { name: '', category: 'hygiene', unit: '', alertThreshold: '', initialQuantity: '', notes: '' },
    );
  }, [open, item]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const pending = create.isPending || update.isPending || remove.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit.trim(),
      alertThreshold: Number(form.alertThreshold) || 0,
      notes: form.notes.trim() || null,
    };
    try {
      if (item) await update.mutateAsync({ id: item.id, ...input });
      else await create.mutateAsync({ ...input, initialQuantity: Number(form.initialQuantity) || 0 });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{item ? t('inventory.item.editTitle') : t('inventory.item.createTitle')}</DialogTitle>
          <DialogDescription>{t('inventory.item.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormField label={t('inventory.item.name')} htmlFor="si-name" required>
            <Input id="si-name" value={form.name} maxLength={120} placeholder={t('inventory.item.namePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-x-3">
            <FormField label={t('inventory.item.category')} htmlFor="si-category" required>
              <select id="si-category" value={form.category} onChange={(e) => set({ category: e.target.value as StockCategory })} className={selectClass}>
                {STOCK_CATEGORIES.map((c) => <option key={c} value={c}>{t(`inventory.categories.${c}`)}</option>)}
              </select>
            </FormField>
            <FormField label={t('inventory.item.unit')} htmlFor="si-unit" required>
              <Input id="si-unit" list="si-units" value={form.unit} maxLength={40} placeholder={t('inventory.item.unitPlaceholder')} onChange={(e) => set({ unit: e.target.value })} />
              <datalist id="si-units">
                {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            {!item && (
              <FormField label={t('inventory.item.initialQuantity')} htmlFor="si-initial">
                <Input id="si-initial" type="number" min={0} step="any" value={form.initialQuantity} placeholder="0" onChange={(e) => set({ initialQuantity: e.target.value })} />
              </FormField>
            )}
            <FormField label={t('inventory.item.alertThreshold')} htmlFor="si-threshold" helperText={t('inventory.item.alertThresholdHelp')}>
              <Input id="si-threshold" type="number" min={0} step="any" value={form.alertThreshold} placeholder="0" onChange={(e) => set({ alertThreshold: e.target.value })} />
            </FormField>
          </div>
          <FormField label={t('inventory.item.notes')} htmlFor="si-notes">
            <Input id="si-notes" value={form.notes} maxLength={500} onChange={(e) => set({ notes: e.target.value })} />
          </FormField>
          <ErrorAlert message={error} />
          <DialogFooter className="flex-wrap gap-2">
            {item && (
              <div className="flex gap-2 me-auto">
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => update.mutateAsync({ id: item.id, isActive: !item.isActive }))}>
                  {item.isActive ? t('inventory.item.putAside') : t('inventory.item.reactivate')}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-danger" disabled={pending} onClick={() => run(() => remove.mutateAsync(item.id))}>
                  {t('common.delete')}
                </Button>
              </div>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A supply's movements, latest first. */
function StockHistoryDialog({ item, onOpenChange }: { item: StockItem | null; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const { data: movements, isLoading, isError, error } = useStockMovements(item?.id ?? null);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('inventory.history.title', { name: item?.name ?? '' })}</DialogTitle>
          <DialogDescription>{item && t('inventory.movement.inStock', { quantity: qty(item.quantity), unit: item.unit })}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorAlert message={errorMessage(error, t)} />
        ) : !movements?.length ? (
          <p className="text-body text-text-secondary">{t('inventory.history.empty')}</p>
        ) : (
          <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {movements.map((m) => {
              const n = Number(m.quantity);
              return (
                <li key={m.id} className="py-2 flex items-start gap-3">
                  <span className={cn('w-16 shrink-0 text-body font-semibold tabular-nums', n > 0 ? 'text-success' : n < 0 ? 'text-danger' : 'text-text-secondary')} dir="ltr">
                    {n > 0 ? '+' : ''}{qty(n)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body text-foreground">
                      {t(`inventory.movement.types.${m.type}`)}
                      <span className="text-text-secondary"> · {t('inventory.history.after', { quantity: qty(m.stockAfter), unit: item?.unit ?? '' })}</span>
                    </p>
                    <p className="text-caption text-text-secondary">
                      {formatDate(m.date)} · {m.createdBy.firstName} {m.createdBy.lastName}
                      {m.expense && ` · ${t('inventory.history.expense', { amount: formatDZD(Number(m.expense.amount), i18n.language) })}`}
                    </p>
                    {m.note && <p className="text-caption text-foreground [overflow-wrap:anywhere]">{m.note}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Supplies: what is left, purchases, uses, counts. */
function SuppliesTab() {
  const { t } = useTranslation();
  const { data: items, isLoading, isError, error } = useStockItems();
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [onlyLow, setOnlyLow] = React.useState(false);
  const [showAside, setShowAside] = React.useState(false);
  const [editing, setEditing] = React.useState<StockItem | null | undefined>(undefined);
  // Ids, so dialogs always show the supply as it is now (another user may have moved it).
  const canEdit = usePermissions().can('inventory', 'edit');
  const [moving, setMoving] = React.useState<{ id: string; type: MovementType } | null>(null);
  const [historyId, setHistoryId] = React.useState<string | null>(null);

  const all = items ?? [];
  const byId = (id: string | null | undefined) => all.find((i) => i.id === id) ?? null;
  const low = all.filter((i) => i.isLow);
  const q = search.trim().toLowerCase();
  const shown = all
    .filter((i) => showAside || i.isActive)
    .filter((i) => !category || i.category === category)
    .filter((i) => !onlyLow || i.isLow)
    .filter((i) => !q || i.name.toLowerCase().includes(q));

  const [view, setView] = useListView('supplies');

  const columns: Column<StockItem>[] = [
    {
      key: 'name',
      header: t('inventory.columns.name'),
      mobile: 'title',
      render: (i) => (
        <div className={cn(!i.isActive && 'opacity-60')}>
          <p className="text-body font-medium text-foreground">{i.name}</p>
          <p className="text-caption text-text-secondary">
            {t(`inventory.categories.${i.category}`)}
            {!i.isActive && ` · ${t('inventory.aside')}`}
          </p>
        </div>
      ),
    },
    {
      key: 'stock',
      header: t('inventory.columns.stock'),
      mobile: 'line',
      render: (i) => (
        <span className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-body font-semibold tabular-nums', i.isLow ? 'text-danger' : 'text-foreground')}>
            {qty(i.quantity)} {i.unit}
          </span>
          {i.isLow && <StatusBadge variant="late">{t('inventory.toBuy')}</StatusBadge>}
        </span>
      ),
    },
    {
      key: 'threshold',
      header: t('inventory.columns.threshold'),
      mobile: 'line',
      render: (i) => (
        <span className="text-body text-text-secondary">{Number(i.alertThreshold) > 0 ? `${qty(i.alertThreshold)} ${i.unit}` : '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {i.isActive && canEdit && (
            <>
              <Button variant="secondary" size="sm" aria-label={t('inventory.movement.types.purchase')} onClick={() => setMoving({ id: i.id, type: 'purchase' })}>
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden lg:inline">{t('inventory.movement.types.purchase')}</span>
              </Button>
              <Button variant="secondary" size="sm" aria-label={t('inventory.movement.types.use')} onClick={() => setMoving({ id: i.id, type: 'use' })}>
                <Minus className="w-4 h-4" />
                <span className="hidden lg:inline">{t('inventory.movement.types.use')}</span>
              </Button>
              <Button variant="ghost" size="sm" aria-label={t('inventory.movement.types.adjustment')} title={t('inventory.movement.types.adjustment')} onClick={() => setMoving({ id: i.id, type: 'adjustment' })}>
                <ClipboardList className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" aria-label={t('inventory.history.open')} title={t('inventory.history.open')} onClick={() => setHistoryId(i.id)}>
            <History className="w-4 h-4" />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="sm" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(i)}>
              <Pencil className="w-4 h-4 text-primary" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('inventory.suppliesTitle')}
        description={t('inventory.description')}
        actions={
          <>
            <ViewToggle view={view} onChange={setView} />
            {canEdit && <CreateButton label={t('inventory.create')} onClick={() => setEditing(null)} />}
          </>
        }
      />

      {low.length > 0 && (
        <button
          type="button"
          onClick={() => setOnlyLow(true)}
          className="w-full text-start flex items-center gap-2 rounded-xl bg-warning-muted px-4 py-2.5 text-body text-foreground"
        >
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <span className="flex-1">{t('inventory.lowBanner', { count: low.length, names: low.slice(0, 4).map((i) => i.name).join(', ') })}</span>
        </button>
      )}

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <SearchInput defaultValue={search} onSearch={setSearch} placeholder={t('inventory.searchPlaceholder')} className="w-full sm:w-64" />
          <select aria-label={t('inventory.item.category')} value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">{t('inventory.allCategories')}</option>
            {STOCK_CATEGORIES.map((c) => <option key={c} value={c}>{t(`inventory.categories.${c}`)}</option>)}
          </select>
          <label className="flex items-center gap-2 cursor-pointer h-10">
            <input type="checkbox" className="w-4 h-4 rounded border-border text-primary" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
            <span className="text-body text-foreground">{t('inventory.onlyLow')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer h-10">
            <input type="checkbox" className="w-4 h-4 rounded border-border text-primary" checked={showAside} onChange={(e) => setShowAside(e.target.checked)} />
            <span className="text-body text-foreground">{t('inventory.showAside')}</span>
          </label>
        </div>
        <p className="text-caption text-text-secondary">{t('inventory.summary', { count: shown.length })}</p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : all.length === 0 ? (
        <EmptyState message={t('inventory.empty')} />
      ) : view === 'cards' ? (
        <CardGrid<StockItem>
          items={shown}
          keyOf={(i) => i.id}
          onOpen={(i) => setHistoryId(i.id)}
          // The same cells and buttons as the table's.
          footer={columns.find((c) => c.key === 'actions')?.render}
          emptyMessage={t('inventory.noMatch')}
          render={(i) => (
            <>
              {columns.find((c) => c.key === 'name')?.render?.(i)}
              {columns.find((c) => c.key === 'stock')?.render?.(i)}
              {Number(i.alertThreshold) > 0 && (
                <span className="block text-caption text-text-secondary">
                  {t('inventory.columns.threshold')} : {qty(i.alertThreshold)} {i.unit}
                </span>
              )}
            </>
          )}
        />
      ) : (
        <DataTable
          columns={columns}
          data={shown}
          keyExtractor={(i) => i.id}
          onRowClick={(i) => setHistoryId(i.id)}
          emptyMessage={t('inventory.noMatch')}
        />
      )}

      <StockItemDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} item={editing ?? null} />
      <StockMovementDialog
        item={byId(moving?.id)}
        open={!!moving}
        onOpenChange={(o) => !o && setMoving(null)}
        initialType={moving?.type}
      />
      <StockHistoryDialog item={byId(historyId)} onOpenChange={(o) => !o && setHistoryId(null)} />
    </div>
  );
}

const INVENTORY_TABS = ['supplies', 'equipment'] as const;
type InventoryTab = (typeof INVENTORY_TABS)[number];

/** The school's inventory: supplies (used up) and equipment (kept, by room). */
export function InventoryPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useTabParam<InventoryTab>(INVENTORY_TABS, 'supplies');
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('inventory.title')} description={t('pageIntro.inventory')} />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'supplies', label: t('inventory.tabs.supplies'), icon: <Package className="w-4 h-4" /> },
          { value: 'equipment', label: t('inventory.tabs.equipment'), icon: <Armchair className="w-4 h-4" /> },
        ]}
      />
      {tab === 'supplies' ? <SuppliesTab /> : <EquipmentTab />}
    </div>
  );
}
