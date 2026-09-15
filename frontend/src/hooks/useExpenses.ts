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

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await apiClient.get<Expense[]>('/payments/expenses');
      return Array.isArray(res.data) ? res.data : [];
    },
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

/** Fetches a fresh signed Cloudinary URL for an expense's receipt on demand. */
export function useExpenseReceiptUrl() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.get<{ url: string }>(`/payments/expenses/${id}/receipt-url`);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to get receipt URL');
      return res.data.url;
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
