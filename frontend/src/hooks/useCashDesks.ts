import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

/** Amounts are decimal strings. */
export interface CashDesk {
  userId: string;
  name: string;
  role: string;
  isActive: boolean;
  /** Left in the desk at the last handover. */
  openingFloat: string;
  /** Cash payments less cash refunds since then. */
  cashIn: string;
  /** Expenses paid from the desk since then. */
  cashOut: string;
  /** What the desk should hold. */
  expected: string;
  paymentsCount: number;
  expensesCount: number;
  oldestAt: string | null;
  lastHandoverAt: string | null;
  /** Too much money, or money kept too long. */
  due: boolean;
}

export interface CashLine {
  id: string;
  amount: string;
  date: string;
}
export interface CashPaymentLine extends CashLine {
  receiptNumber: string;
  isCorrection: boolean;
  childName: string;
}
export interface CashExpenseLine extends CashLine {
  description: string;
  category: string;
}
export interface CashDeskDetail extends CashDesk {
  payments: CashPaymentLine[];
  expenses: CashExpenseLine[];
}

export interface CashSettings {
  cashAlertAmount: string;
  cashAlertDays: number;
}

export interface CashHandover {
  id: string;
  kind: 'handover' | 'deposit';
  cashierUserId: string;
  cashierName: string;
  collectedByName: string;
  openingFloat: string;
  cashIn: string;
  cashOut: string;
  expectedAmount: string;
  countedAmount: string;
  floatLeft: string;
  /** Counted less the float left. */
  taken: string;
  /** Counted less expected: negative when money is missing. */
  difference: string;
  reason: string | null;
  note: string | null;
  createdAt: string;
}
export interface CashHandoverDetail extends CashHandover {
  schoolName: string;
  payments: CashPaymentLine[];
  expenses: CashExpenseLine[];
}

export interface CashSummary {
  mine: { expected: string; due: boolean; oldestAt: string | null } | null;
  toCollect: { count: number; total: string } | null;
}

async function get<T>(url: string, fallback: string): Promise<T> {
  const res = await apiClient.get<T>(url);
  if (!res.success) throw apiError(res.error, fallback);
  return res.data as T;
}

/** My own desk, with what is in it. */
export function useMyCashDesk(enabled = true) {
  return useQuery({
    queryKey: ['cash-desks', 'mine'],
    enabled,
    staleTime: 0,
    queryFn: () => get<CashDeskDetail>('/cash-desks/mine', 'Failed to load the cash desk'),
  });
}

/** Every desk of the school (collectors). */
export function useCashDesks(enabled = true) {
  return useQuery({
    queryKey: ['cash-desks', 'list'],
    enabled,
    staleTime: 0,
    queryFn: () => get<{ desks: CashDesk[]; settings: CashSettings }>('/cash-desks', 'Failed to load the cash desks'),
  });
}

/** One person's desk, with what is in it (collectors). */
export function useCashDesk(userId: string | null) {
  return useQuery({
    queryKey: ['cash-desks', 'desk', userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: () => get<CashDeskDetail>(`/cash-desks/${userId}`, 'Failed to load the cash desk'),
  });
}

/** Past handovers, latest first. */
export function useCashHandovers(enabled = true) {
  return useQuery({
    queryKey: ['cash-desks', 'handovers'],
    enabled,
    staleTime: 0,
    queryFn: () => get<CashHandover[]>('/cash-desks/handovers', 'Failed to load the handovers'),
  });
}

/** One handover with what it counted (the slip). */
export function useCashHandover(id: string | null) {
  return useQuery({
    queryKey: ['cash-desks', 'handover', id],
    enabled: !!id,
    queryFn: () => get<CashHandoverDetail>(`/cash-desks/handovers/${id}`, 'Failed to load the handover'),
  });
}

/** My desk and the desks due (dashboard). */
export function useCashSummary(enabled = true) {
  return useQuery({
    queryKey: ['cash-desks', 'summary'],
    enabled,
    // Money moves from other screens and other people: always asked again.
    staleTime: 0,
    queryFn: () => get<CashSummary>('/cash-desks/summary', 'Failed to load'),
  });
}

export interface CollectInput {
  userId: string;
  countedAmount: number;
  floatLeft: number;
  expectedAmount: number;
  reason?: string | null;
  note?: string | null;
}

export function useCollectCashDesk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...input }: CollectInput) => {
      const res = await apiClient.post<{ id: string }>(`/cash-desks/${userId}/collect`, input);
      if (!res.success) throw apiError(res.error, 'Failed to collect the cash desk');
      return res.data as { id: string };
    },
    // Also after a refusal: the desk changed meanwhile.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['cash-desks'] });
      void qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateCashSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cashAlertAmount: number; cashAlertDays: number }) => {
      const res = await apiClient.put<CashSettings>('/cash-desks/settings', input);
      if (!res.success) throw apiError(res.error, 'Failed to save');
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cash-desks'] }),
  });
}
