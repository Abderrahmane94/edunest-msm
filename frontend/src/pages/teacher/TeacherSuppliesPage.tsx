import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Minus } from 'lucide-react';
import { Button, EmptyState, ErrorAlert, ListSkeleton, PageHeader, SearchInput, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errorMessage';
import { StockMovementDialog } from '@/components/inventory/StockMovementDialog';
import { qty, useStockItems } from '@/hooks/useInventory';

/** The school's supplies: a teacher records what they use. */
export function TeacherSuppliesPage() {
  const { t } = useTranslation();
  const { data: items, isLoading, isError, error } = useStockItems();
  const [search, setSearch] = React.useState('');
  const [usingId, setUsingId] = React.useState<string | null>(null);
  const using = (items ?? []).find((i) => i.id === usingId) ?? null;

  const q = search.trim().toLowerCase();
  const shown = (items ?? []).filter((i) => i.isActive && (!q || i.name.toLowerCase().includes(q)));

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title={t('inventory.teacher.title')} description={t('inventory.teacher.description')} />
      <SearchInput defaultValue={search} onSearch={setSearch} placeholder={t('inventory.searchPlaceholder')} />
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorAlert message={errorMessage(error, t)} />
      ) : shown.length === 0 ? (
        <EmptyState message={t(items?.length ? 'inventory.noMatch' : 'inventory.teacher.empty')} />
      ) : (
        <ul className="bg-card border border-border rounded-lg divide-y divide-border">
          {shown.map((i) => (
            <li key={i.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-foreground truncate">{i.name}</p>
                <p className="text-caption text-text-secondary flex items-center gap-2 flex-wrap">
                  <span className={cn(i.isLow && 'text-danger font-medium')}>
                    {t('inventory.movement.inStock', { quantity: qty(i.quantity), unit: i.unit })}
                  </span>
                  {i.isLow && <StatusBadge variant="late">{t('inventory.toBuy')}</StatusBadge>}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" disabled={Number(i.quantity) <= 0} onClick={() => setUsingId(i.id)}>
                <Minus className="w-4 h-4" />
                {t('inventory.teacher.used')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <StockMovementDialog
        item={using}
        open={!!using}
        types={['use']}
        onOpenChange={(o) => !o && setUsingId(null)}
      />
    </div>
  );
}
