import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

export const STOCK_CATEGORIES = ['hygiene', 'cleaning', 'stationery', 'crafts', 'food', 'other'] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  unit: string;
  /** Decimal strings, as the server sends them. */
  quantity: string;
  alertThreshold: string;
  notes: string | null;
  isActive: boolean;
  /** At or below its alert threshold: to buy again. */
  isLow: boolean;
}

export interface StockMovement {
  id: string;
  type: 'purchase' | 'use' | 'adjustment';
  /** Signed change of the stock. */
  quantity: string;
  stockAfter: string;
  date: string;
  note: string | null;
  createdBy: { id: string; firstName: string; lastName: string; role: string };
  expense: { id: string; amount: string } | null;
}

export type StockMovementInput =
  | { type: 'purchase'; quantity: number; date: string; note?: string; expense?: { amount: number; category: string } }
  | { type: 'use' | 'adjustment'; quantity: number; date: string; note?: string };

export interface StockItemInput {
  name: string;
  category: StockCategory;
  unit: string;
  alertThreshold: number;
  notes?: string | null;
  initialQuantity?: number;
}

/** A quantity without useless decimals ("3", "2.5"). */
export const qty = (v: string | number) => String(Number(v));

export function useStockItems() {
  return useQuery({
    queryKey: ['inventory', 'items'],
    // Teachers and admins change it all day: fetched again on each visit.
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<StockItem[]>('/inventory/items');
      if (!res.success) throw apiError(res.error, 'Failed to load supplies');
      return res.data as StockItem[];
    },
  });
}

/** How many supplies are to buy again (admin dashboard). */
export function useLowStockCount(enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    staleTime: 0,
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<{ lowCount: number }>('/inventory/summary');
      if (!res.success) throw apiError(res.error, 'Failed to load');
      return (res.data as { lowCount: number }).lowCount;
    },
  });
}

export function useStockMovements(itemId: string | null) {
  return useQuery({
    queryKey: ['inventory', 'movements', itemId],
    staleTime: 0,
    enabled: !!itemId,
    queryFn: async () => {
      const res = await apiClient.get<StockMovement[]>(`/inventory/items/${itemId}/movements`);
      if (!res.success) throw apiError(res.error, 'Failed to load');
      return res.data as StockMovement[];
    },
  });
}

function useInventoryMutation<V>(fn: (v: V) => Promise<unknown>, alsoExpenses = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      // A purchase may have been recorded as an expense too.
      if (alsoExpenses) void qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useCreateStockItem() {
  return useInventoryMutation(async (input: StockItemInput) => {
    const res = await apiClient.post<StockItem>('/inventory/items', input);
    if (!res.success) throw apiError(res.error, 'Failed to add the supply');
    return res.data;
  });
}

export function useUpdateStockItem() {
  return useInventoryMutation(async ({ id, ...input }: Partial<StockItemInput> & { id: string; isActive?: boolean }) => {
    const res = await apiClient.put<StockItem>(`/inventory/items/${id}`, input);
    if (!res.success) throw apiError(res.error, 'Failed to update the supply');
    return res.data;
  });
}

export function useDeleteStockItem() {
  return useInventoryMutation(async (id: string) => {
    const res = await apiClient.delete(`/inventory/items/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to delete the supply');
    return res.data;
  });
}

export function useRecordStockMovement() {
  return useInventoryMutation(async ({ itemId, ...input }: StockMovementInput & { itemId: string }) => {
    const res = await apiClient.post(`/inventory/items/${itemId}/movements`, input);
    if (!res.success) throw apiError(res.error, 'Failed to record');
    return res.data;
  }, true);
}
