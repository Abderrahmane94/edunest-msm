import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface EmployeeSalary {
  baseSalary: string;
  currency: string;
  effectiveFrom: string;
  notes?: string | null;
}

export interface EmployeeRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  salary: EmployeeSalary | null;
  lastPayment: {
    month: number;
    year: number;
    netSalary: string;
    paidAt: string;
  } | null;
}

export interface SalaryPayment {
  id: string;
  userId: string;
  employeeName: string;
  role: string;
  month: number;
  year: number;
  baseSalary: string;
  bonuses: string;
  deductions: string;
  netSalary: string;
  paidAt: string;
  note?: string | null;
  createdAt: string;
}

export interface SetSalaryInput {
  baseSalary: number;
  currency?: string;
  effectiveFrom: string;
  notes?: string;
}

export interface RecordPaymentInput {
  userId: string;
  month: number;
  year: number;
  baseSalary: number;
  bonuses?: number;
  deductions?: number;
  paidAt: string;
  note?: string;
}

export function usePayrollEmployees() {
  return useQuery<EmployeeRecord[]>({
    queryKey: ['payroll', 'employees'],
    queryFn: async () => {
      const res = await apiClient.get<EmployeeRecord[]>('/payroll/employees');
      return res.data ?? [];
    },
  });
}

export function useSetSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: SetSalaryInput }) => {
      const res = await apiClient.put<EmployeeSalary>(`/payroll/employees/${userId}/salary`, data);
      if (!res.success) throw new Error(res.error?.message ?? 'PAYROLL_ERROR');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', 'employees'] });
    },
  });
}

export function usePayrollPayments(filters: {
  userId?: string;
  year?: number;
  month?: number;
  page?: number;
  pageSize?: number;
}) {
  return useQuery<{ items: SalaryPayment[]; total: number }>({
    queryKey: ['payroll', 'payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.year) params.set('year', String(filters.year));
      if (filters.month) params.set('month', String(filters.month));
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      const res = await apiClient.get<SalaryPayment[]>(`/payroll/payments?${params}`);
      return {
        items: res.data ?? [],
        total: (res as { meta?: { total?: number } }).meta?.total ?? 0,
      };
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecordPaymentInput) => {
      const res = await apiClient.post<SalaryPayment>('/payroll/payments', data);
      if (!res.success) throw new Error(res.error?.message ?? 'PAYROLL_ERROR');
      return res.data as SalaryPayment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/payroll/payments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}
