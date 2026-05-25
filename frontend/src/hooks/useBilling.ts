import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceAnnual?: number;
  currency: string;
  maxChildren?: number;
  maxUsers?: number;
  isActive: boolean;
  createdAt: string;
}

export interface SchoolSubscription {
  id: string;
  schoolId: string;
  planId: string;
  status: 'trial' | 'active' | 'overdue' | 'cancelled' | 'suspended';
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  cancelledAt?: string;
  createdAt: string;
  school: { id: string; name: string; wilaya: string; isActive: boolean };
  plan: SubscriptionPlan;
  payments: SubscriptionPayment[];
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  recordedBy: string;
  note?: string;
  createdAt: string;
}

export interface BillingStats {
  mrr: number;
  revenueThisMonth: number;
  totalRevenue: number;
  active: number;
  trial: number;
  overdue: number;
  cancelled: number;
  suspended: number;
  total: number;
}

function fmt(raw: Record<string, unknown>) {
  return {
    ...raw,
    priceMonthly: Number(raw.priceMonthly),
    priceAnnual: raw.priceAnnual != null ? Number(raw.priceAnnual) : undefined,
  } as SubscriptionPlan;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const res = await apiClient.get<unknown[]>('/billing/plans');
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw.map((p) => fmt(p as Record<string, unknown>));
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'isActive'>) => {
      const res = await apiClient.post('/billing/plans', data);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<SubscriptionPlan> & { id: string }) => {
      const res = await apiClient.put(`/billing/plans/${id}`, data);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-plans'] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/billing/plans/${id}`);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-plans'] }),
  });
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function useSubscriptions() {
  return useQuery({
    queryKey: ['billing-subscriptions'],
    queryFn: async () => {
      const res = await apiClient.get<unknown[]>('/billing/subscriptions');
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw as SchoolSubscription[];
    },
  });
}

export function useAssignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { schoolId: string; planId: string; billingCycle: string; startDate: string; trialDays?: number }) => {
      const res = await apiClient.post('/billing/subscriptions', data);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-subscriptions'] }),
  });
}

export function useUpdateSubscriptionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/billing/subscriptions/${id}/status`, { status });
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-subscriptions'] }),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, ...data }: { subscriptionId: string; amount: number; periodStart: string; periodEnd: string; paidAt: string; note?: string }) => {
      const res = await apiClient.post(`/billing/subscriptions/${subscriptionId}/payments`, data);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['billing-school-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
}

// ─── School Payments ──────────────────────────────────────────────────────────

export interface SchoolPaymentRecord {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  recordedBy: string;
  note?: string;
  createdAt: string;
  subscription: {
    status: string;
    school: { id: string; name: string };
    plan: { name: string; priceMonthly: number };
  };
}

export function useSchoolPayments(schoolId: string | null, filters?: { from?: string; to?: string; status?: string }) {
  return useQuery({
    queryKey: ['billing-school-payments', schoolId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (schoolId) params.set('schoolId', schoolId);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      if (filters?.status) params.set('status', filters.status);
      const res = await apiClient.get<unknown[]>(`/billing/payments?${params.toString()}`);
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw as SchoolPaymentRecord[];
    },
    enabled: !!schoolId,
  });
}

export function useDeletedPayments(schoolId?: string) {
  return useQuery({
    queryKey: ['billing-deleted-payments', schoolId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (schoolId) params.set('schoolId', schoolId);
      const res = await apiClient.get<unknown[]>(`/billing/payments/deleted?${params.toString()}`);
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw as SchoolPaymentRecord[];
    },
  });
}

export function useRestorePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.put(`/billing/payments/${id}/restore`, {});
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-school-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-deleted-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; amount?: number; periodStart?: string; periodEnd?: string; paidAt?: string; note?: string | null }) => {
      const res = await apiClient.put(`/billing/payments/${id}`, data);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-school-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/billing/payments/${id}`);
      if (!res.success) throw new Error(res.error?.code ?? res.error?.message ?? 'BILLING_ERROR');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-school-payments'] });
      qc.invalidateQueries({ queryKey: ['billing-stats'] });
    },
  });
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function useBillingStats() {
  return useQuery({
    queryKey: ['billing-stats'],
    queryFn: async () => {
      const res = await apiClient.get<BillingStats>('/billing/stats');
      return res.data as BillingStats;
    },
  });
}
