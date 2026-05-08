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
      const res = await apiClient.get<{ fee_structures: FeeStructure[] }>('/finance/fee-structures');
      return res.data?.fee_structures ?? [];
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
      const res = await apiClient.post('/finance/fee-structures', data);
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
      const res = await apiClient.get<{ invoices: Invoice[] }>('/finance/invoices');
      return res.data?.invoices ?? [];
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
    }) => {
      const res = await apiClient.post('/finance/invoices', data);
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
    }) => {
      const res = await apiClient.post('/finance/invoices/bulk', data);
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
      const res = await apiClient.get<{ cash_payments: CashPayment[] }>(
        `/finance/invoices/${invoiceId}/cash-payments`
      );
      return res.data?.cash_payments ?? [];
    },
    enabled: !!invoiceId,
  });
}

/* ─── Expenses ─── */

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await apiClient.get<{ expenses: Expense[] }>('/finance/expenses');
      return res.data?.expenses ?? [];
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
      const res = await apiClient.get<FinanceSummary>('/finance/report/summary');
      return res.data ?? { total_invoiced: 0, total_collected: 0, total_outstanding: 0, total_expenses: 0 };
    },
  });
}

export function usePaymentMethodBreakdown() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await apiClient.get<PaymentMethodBreakdown>('/finance/report/payment-methods');
      return res.data ?? { cash_total: 0, online_total: 0, cash_count: 0, online_count: 0 };
    },
  });
}
