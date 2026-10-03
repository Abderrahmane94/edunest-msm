import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  createdAt: string;
}

export interface CreateExpenseInput {
  category: string;
  description: string;
  amount: number;
  currency?: string;
  date: string;
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
  return useQuery({
    queryKey: ['expenses', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(EXPENSES_PAGE_SIZE) });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const res = await apiClient.get<Expense[]>(`/payments/expenses?${params.toString()}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load expenses');
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
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const res = await apiClient.post<Expense>('/payments/expenses', input);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create expense');
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
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update expense');
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
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete expense');
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
    mutationFn: async (id: string): Promise<{ blob: Blob; fileName: string }> => {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${baseUrl}/payments/expenses/${id}/receipt`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? 'Failed to load receipt');
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
        throw new Error(data.error?.message ?? 'Failed to upload receipt');
      }
      return data.data as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
