import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/* ─── Types ─── */

export interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  level?: string;
  description?: string;
  academic_year_id: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  child_id: string;
  child_name: string;
  parent_user_id: string;
  parent_name: string;
  fee_structure_id: string;
  fee_structure_name: string;
  amount: number;
  discount_amount: number;
  final_amount: number;
  remaining_amount?: number;
  currency: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  payment_method?: 'online' | 'cash';
  issued_at?: string;
  paid_at?: string;
  created_at: string;
}

export interface CashPayment {
  id: string;
  invoice_id: string;
  amount: number;
  received_by: string;
  receiver_name: string;
  received_at: string;
  note?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_public_id?: string;
  created_by_name: string;
  created_at: string;
}

export interface FinanceSummary {
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  total_expenses: number;
}

export interface PaymentMethodBreakdown {
  cash_total: number;
  online_total: number;
  cash_count: number;
  online_count: number;
}

/* ─── Fee Structures ─── */

export function useFeeStructures() {
  return useQuery({
    queryKey: ['fee-structures'],
    queryFn: async () => {
      const res = await apiClient.get<FeeStructure[]>('/finance/fee-structures');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useFeeStructure(id: string) {
  return useQuery({
    queryKey: ['fee-structures', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/finance/fee-structures/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Not found');
      return res.data as unknown as FeeStructure;
    },
    enabled: !!id,
  });
}

export function useUpdateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; amount?: number; frequency?: string; level?: string; description?: string }) => {
      const res = await apiClient.put(`/finance/fee-structures/${id}`, data);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update fee structure');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      queryClient.invalidateQueries({ queryKey: ['fee-structures', variables.id] });
    },
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/finance/fee-structures/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete fee structure');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      amount: number;
      currency: string;
      frequency: string;
      level?: string;
      description?: string;
      academic_year_id: string;
    }) => {
      const res = await apiClient.post('/finance/fee-structures', {
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        frequency: data.frequency,
        level: data.level,
        description: data.description,
        academicYearId: data.academic_year_id,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create fee structure');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
  });
}

/* ─── Invoices ─── */

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await apiClient.get<Invoice[]>('/finance/invoices');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/finance/invoices/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Not found');
      return res.data as unknown as Invoice;
    },
    enabled: !!id,
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiClient.patch(`/finance/invoices/${invoiceId}/cancel`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to cancel invoice');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      child_id: string;
      parent_user_id: string;
      fee_structure_id: string;
      due_date: string;
      amount: number;
    }) => {
      const res = await apiClient.post('/finance/invoices', {
        childId: data.child_id,
        parentUserId: data.parent_user_id,
        feeStructureId: data.fee_structure_id,
        dueDate: data.due_date,
        amount: data.amount,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create invoice');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useBulkGenerateInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      classroom_id: string;
      fee_structure_id: string;
      due_date: string;
      amount: number;
    }) => {
      const res = await apiClient.post('/finance/invoices/bulk', {
        classroomId: data.classroom_id,
        feeStructureId: data.fee_structure_id,
        dueDate: data.due_date,
        amount: data.amount,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to bulk generate invoices');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiClient.post(`/finance/invoices/${invoiceId}/send`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to send invoice');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRecordCashPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      invoiceId: string;
      amount_received: number;
      received_at: string;
      note?: string;
    }) => {
      const { invoiceId, ...body } = data;
      const res = await apiClient.post(`/finance/invoices/${invoiceId}/cash-payment`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['cash-payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}

export function useCashPayments(invoiceId?: string) {
  return useQuery({
    queryKey: ['cash-payments', invoiceId],
    queryFn: async () => {
      const res = await apiClient.get<CashPayment[]>(
        `/finance/invoices/${invoiceId}/cash-payments`
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!invoiceId,
  });
}

/* ─── Expenses ─── */

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await apiClient.get<Expense[]>('/finance/expenses');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(`/finance/expenses/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Not found');
      return res.data as unknown as Expense;
    },
    enabled: !!id,
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; category?: string; description?: string; amount?: number; date?: string }) => {
      const res = await apiClient.put(`/finance/expenses/${id}`, data);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update expense');
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', variables.id] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/finance/expenses/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete expense');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      category: string;
      description: string;
      amount: number;
      date: string;
    }) => {
      const res = await apiClient.post('/finance/expenses', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    },
  });
}

/* ─── Reports ─── */

export function useFinanceSummary() {
  return useQuery({
    queryKey: ['finance-summary'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/finance/report/summary');
      const d = res.data as Record<string, unknown> | null;
      if (!d) return { total_invoiced: 0, total_collected: 0, total_outstanding: 0, total_expenses: 0 };

      // Backend returns: { totalRevenue, collectionRate, totalExpenses, paymentMethodBreakdown }
      const pm = d.paymentMethodBreakdown as { online?: { total?: number }; cash?: { total?: number } } | undefined;
      const total_collected = (pm?.online?.total ?? 0) + (pm?.cash?.total ?? 0);
      const total_invoiced = (d.totalRevenue as number) ?? 0;

      return {
        total_invoiced,
        total_collected,
        total_outstanding: Math.max(0, total_invoiced - total_collected),
        total_expenses: (d.totalExpenses as number) ?? 0,
      } as FinanceSummary;
    },
  });
}

export function usePaymentMethodBreakdown() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/finance/report/payment-methods');
      const d = res.data as { online?: { count?: number; total?: number }; cash?: { count?: number; total?: number } } | null;
      return {
        cash_total: d?.cash?.total ?? 0,
        online_total: d?.online?.total ?? 0,
        cash_count: d?.cash?.count ?? 0,
        online_count: d?.online?.count ?? 0,
      } as PaymentMethodBreakdown;
    },
  });
}
