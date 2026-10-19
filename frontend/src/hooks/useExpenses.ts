import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';
import { useYearScope } from './useSelectedYear';

export interface Expense {
  id: string;
  schoolId: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  receiptPublicId: string | null;
  createdByUserId: string;
  /** Paid with money from this person's cash desk. */
  paidFromCashUserId: string | null;
  /** The cash handover it was counted in: it can no longer be changed. */
  cashHandoverId: string | null;
  createdAt: string;
  /** The last change after it was recorded (in the list). */
  lastChange?: { action: 'updated' | 'receipt' | 'restored'; byName: string; at: string } | null;
}

/** One field an edit changed; values as shown (amount "1500.00", date "2026-10-19", year by name). */
export interface ExpenseFieldChange {
  field: 'category' | 'description' | 'amount' | 'date' | 'academicYear' | 'paidFromCash' | 'receipt';
  from: string | boolean | null;
  to: string | boolean | null;
}

/** The expense as it was (when recorded, or when deleted). */
export interface ExpenseSnapshot {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  academicYearName: string | null;
  receiptPublicId: string | null;
  paidFromCashUserId: string | null;
}

/** One step in an expense's history. */
export interface ExpenseHistoryEntry {
  id: string;
  expenseId: string;
  action: 'created' | 'updated' | 'receipt' | 'deleted' | 'restored';
  changes: ExpenseFieldChange[];
  snapshot: ExpenseSnapshot | null;
  /** A receipt file kept with this step (the one replaced, or a deleted expense's). */
  hasReceipt: boolean;
  byName: string;
  at: string;
}

export interface CreateExpenseInput {
  category: string;
  description: string;
  amount: number;
  currency?: string;
  date: string;
  /** Paid with money from my cash desk. */
  paidFromCash?: boolean;
  /** The form's id: sent again, the expense is saved once. */
  clientId?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface ExpenseFilters {
  category?: string;
  /** YYYY-MM-DD, inclusive. */
  from?: string;
  /** YYYY-MM-DD, inclusive. */
  to?: string;
  search?: string;
  hasReceipt?: 'true' | 'false';
}

export const EXPENSES_PAGE_SIZE = 20;

/**
 * One page of the school's expenses matching `filters`, with the number and
 * total amount of all matching expenses (not just this page).
 */
export function useExpenses(filters: ExpenseFilters, page: number) {
  const { yearId, ready } = useYearScope();
  return useQuery({
    queryKey: ['expenses', filters, page, yearId],
    enabled: ready,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(EXPENSES_PAGE_SIZE) });
      if (yearId) params.set('academic_year_id', yearId);
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const res = await apiClient.get<Expense[]>(`/payments/expenses?${params.toString()}`);
      if (!res.success) throw apiError(res.error, 'Failed to load expenses');
      const expenses = Array.isArray(res.data) ? res.data : [];
      const meta = res.meta as { pagination?: { total?: number }; totalAmount?: string } | undefined;
      return {
        expenses,
        total: meta?.pagination?.total ?? expenses.length,
        totalAmount: meta?.totalAmount ?? '0.00',
      };
    },
    // Keep showing the current rows while the next page/filter loads.
    placeholderData: (prev) => prev,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const { yearId } = useYearScope();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      // Counted in the year being looked at.
      const res = await apiClient.post<Expense>('/payments/expenses', { ...input, academicYearId: yearId });
      if (!res.success) throw apiError(res.error, 'Failed to create expense');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateExpenseInput & { id: string }) => {
      const res = await apiClient.put<Expense>(`/payments/expenses/${id}`, input);
      if (!res.success) throw apiError(res.error, 'Failed to update expense');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/payments/expenses/${id}`);
      if (!res.success) throw apiError(res.error, 'Failed to delete expense');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

/** Everything that happened to an expense, oldest first. */
export function useExpenseHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['expenses', 'history', id],
    enabled: !!id,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<ExpenseHistoryEntry[]>(`/payments/expenses/${id}/history`);
      if (!res.success) throw apiError(res.error, 'Failed to load the history');
      return res.data ?? [];
    },
  });
}

/** Deleted expenses of the year looked at, newest first, with who deleted them. */
export function useDeletedExpenses(enabled: boolean) {
  const { yearId, ready } = useYearScope();
  return useQuery({
    queryKey: ['expenses', 'deleted', yearId],
    enabled: enabled && ready,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiClient.get<ExpenseHistoryEntry[]>(
        `/payments/expenses/deleted${yearId ? `?academic_year_id=${yearId}` : ''}`,
      );
      if (!res.success) throw apiError(res.error, 'Failed to load deleted expenses');
      return res.data ?? [];
    },
  });
}

/** Puts a deleted expense back as it was. */
export function useRestoreExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (changeId: string) => {
      const res = await apiClient.post<Expense>(`/payments/expenses/changes/${changeId}/restore`, {});
      if (!res.success) throw apiError(res.error, 'Failed to restore the expense');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

/** Reads the exact (UTF-8) file name from a Content-Disposition header. */
function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

/**
 * Downloads an expense's receipt file — in its uploaded format, with the
 * server's suggested name ("<date> - <description>.<ext>").
 */
export function useExpenseReceiptFile() {
  return useMutation({
    /** An expense's receipt, or with `change` one kept in its history. */
    mutationFn: async (id: string | { change: string }): Promise<{ blob: Blob; fileName: string }> => {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const path = typeof id === 'string' ? id : `changes/${id.change}`;
      const response = await fetch(`${baseUrl}/payments/expenses/${path}/receipt`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw apiError(data?.error, 'Failed to load receipt');
      }
      const blob = await response.blob();
      const fileName = fileNameFromDisposition(response.headers.get('Content-Disposition')) ?? 'receipt';
      return { blob, fileName };
    },
  });
}

export function useUploadExpenseReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await fetch(`${baseUrl}/payments/expenses/${id}/receipt`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        throw apiError(data.error, 'Failed to upload receipt');
      }
      return data.data as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
