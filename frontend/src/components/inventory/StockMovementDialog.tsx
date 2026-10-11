import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ErrorAlert, Input,
} from '@/components/ui';
import { FormField } from '@/components/forms';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { qty, useRecordStockMovement, type StockItem, type StockMovementInput } from '@/hooks/useInventory';
import { usePermissions } from '@/lib/roles';

export type MovementType = StockMovementInput['type'];

const EXPENSE_CATEGORIES = ['supplies', 'food', 'maintenance', 'utilities', 'transport', 'other'];

/** Today's date as YYYY-MM-DD in the viewer's local time zone. */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Records a change of a supply's stock: a purchase (optionally also recorded
 * as an expense), a use, or a count of what is really there. Teachers get
 * the use only (`types`).
 */
export function StockMovementDialog({
  item,
  open,
  onOpenChange,
  types = ['purchase', 'use', 'adjustment'],
  initialType = types[0],
}: {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types?: MovementType[];
  initialType?: MovementType;
}) {
  const { t } = useTranslation();
  const record = useRecordStockMovement();
  // Expenses are the director's: the administrative staff record the purchase only.
  const canRecordExpense = usePermissions().can('expenses', 'edit');
  const [type, setType] = React.useState<MovementType>(initialType);
  const [quantity, setQuantity] = React.useState('');
  const [date, setDate] = React.useState(localToday());
  const [note, setNote] = React.useState('');
  const [withExpense, setWithExpense] = React.useState(true);
  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('supplies');
  const [error, setError] = React.useState<string | null>(null);

  // Reset when opened for a supply — not when its data refreshes while typing.
  const itemId = item?.id;
  const itemRef = React.useRef(item);
  itemRef.current = item;
  React.useEffect(() => {
    const item = itemRef.current;
    if (!open || !item) return;
    setType(initialType);
    setQuantity(initialType === 'adjustment' ? qty(item.quantity) : '');
    setDate(localToday());
    setNote('');
    setWithExpense(canRecordExpense);
    setAmount('');
    setCategory(item.category === 'food' ? 'food' : 'supplies');
    setError(null);
  }, [open, itemId, initialType]);

  if (!item) return null;

  const n = Number(quantity);
  const after =
    quantity === '' || Number.isNaN(n)
      ? null
      : type === 'purchase'
        ? Number(item.quantity) + n
        : type === 'use'
          ? Number(item.quantity) - n
          : n;

  function pickType(next: MovementType) {
    setType(next);
    setError(null);
    setQuantity(next === 'adjustment' ? qty(item!.quantity) : '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (quantity === '' || Number.isNaN(n) || n < 0 || (type !== 'adjustment' && n === 0)) {
      setError(t('inventory.movement.quantityInvalid'));
      return;
    }
    if (type === 'use' && after !== null && after < 0) {
      setError(t('inventory.movement.notEnough', { quantity: qty(item!.quantity), unit: item!.unit }));
      return;
    }
    const base = { quantity: n, date, ...(note.trim() ? { note: note.trim() } : {}) };
    const input: StockMovementInput =
      type === 'purchase'
        ? { type, ...base, ...(withExpense && Number(amount) > 0 ? { expense: { amount: Number(amount), category } } : {}) }
        : { type, ...base };
    if (type === 'purchase' && withExpense && !(Number(amount) > 0)) {
      setError(t('inventory.movement.amountRequired'));
      return;
    }
    try {
      await record.mutateAsync({ itemId: item!.id, ...input });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            {t('inventory.movement.inStock', { quantity: qty(item.quantity), unit: item.unit })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {types.length > 1 && (
            <div role="tablist" className="grid grid-cols-3 gap-1 p-1 bg-subtle rounded-lg">
              {types.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  role="tab"
                  aria-selected={type === ty}
                  onClick={() => pickType(ty)}
                  className={cn(
                    'px-2 py-1.5 rounded-md text-caption font-medium',
                    type === ty ? 'bg-card text-foreground shadow-sm' : 'text-text-secondary hover:text-foreground',
                  )}
                >
                  {t(`inventory.movement.types.${ty}`)}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3">
            <FormField
              label={type === 'adjustment' ? t('inventory.movement.counted', { unit: item.unit }) : t('inventory.movement.quantity', { unit: item.unit })}
              htmlFor="mv-quantity"
              required
            >
              <Input
                id="mv-quantity"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField label={t('inventory.movement.date')} htmlFor="mv-date" required>
              <Input id="mv-date" type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>
          {after !== null && (
            <p className={cn('text-caption', after < 0 ? 'text-danger' : 'text-text-secondary')}>
              {t('inventory.movement.after', { quantity: qty(after), unit: item.unit })}
            </p>
          )}

          {type === 'purchase' && canRecordExpense && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  checked={withExpense}
                  onChange={(e) => setWithExpense(e.target.checked)}
                />
                <span className="text-body text-foreground">{t('inventory.movement.alsoExpense')}</span>
              </label>
              {withExpense && (
                <div className="grid grid-cols-2 gap-x-3">
                  <FormField label={t('inventory.movement.amount')} htmlFor="mv-amount" required className="mb-0">
                    <Input id="mv-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </FormField>
                  <FormField label={t('inventory.movement.expenseCategory')} htmlFor="mv-category" className="mb-0">
                    <select
                      id="mv-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-10 rounded-md border border-border bg-card px-2 text-body"
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{t(`finance.expenses.categories.${c}`)}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}
            </div>
          )}

          <FormField label={t('inventory.movement.note')} htmlFor="mv-note">
            <Input
              id="mv-note"
              value={note}
              maxLength={500}
              placeholder={t(`inventory.movement.notePlaceholder.${type}`)}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>

          <ErrorAlert message={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? t('common.loading') : t(`inventory.movement.save.${type}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
