import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Enrollment {
  id: string;
  childId: string;
  branchId: string;
  academicYearId: string;
  startDate: string;
  status: 'active' | 'withdrawn' | 'completed';
  registrationFee: string | null;
  recurringFee: string;
  withdrawalDate: string | null;
  createdAt: string;
  child?: { id: string; firstName: string; lastName: string };
  branch?: { id: string; name: string };
  academicYear?: { id: string; name: string };
}

export interface EnrollmentGenerationResult {
  enrollmentId: string;
  periodsCreated: number;
  earliestPeriodStart: string;
  latestPeriodEnd: string;
  totalAmountDue: string;
}

export interface CreateEnrollmentInput {
  childId: string;
  branchId: string;
  academicYearId: string;
  startDate: string;
  recurringFee?: number;
  registrationFee?: number | null;
  firstPeriodAmountDue?: number;
}

interface EnrollmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

function mapEnrollment(raw: Record<string, unknown>): Enrollment {
  const child = raw.child as Record<string, unknown> | undefined;
  const branch = raw.branch as Record<string, unknown> | undefined;
  const academicYear = raw.academicYear as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    childId: (raw.childId ?? raw.child_id) as string,
    branchId: (raw.branchId ?? raw.branch_id) as string,
    academicYearId: (raw.academicYearId ?? raw.academic_year_id) as string,
    startDate: (raw.startDate ?? raw.start_date) as string,
    status: (raw.status as Enrollment['status']) ?? 'active',
    registrationFee: (raw.registrationFee ?? raw.registration_fee ?? null) as string | null,
    recurringFee: (raw.recurringFee ?? raw.recurring_fee ?? '0') as string,
    withdrawalDate: (raw.withdrawalDate ?? raw.withdrawal_date ?? null) as string | null,
    createdAt: (raw.createdAt ?? raw.created_at) as string,
    child: child
      ? {
          id: child.id as string,
          firstName: (child.firstName ?? child.first_name) as string,
          lastName: (child.lastName ?? child.last_name) as string,
        }
      : undefined,
    branch: branch
      ? { id: branch.id as string, name: branch.name as string }
      : undefined,
    academicYear: academicYear
      ? { id: academicYear.id as string, name: academicYear.name as string }
      : undefined,
  };
}

export function useEnrollments(params: EnrollmentsParams = {}) {
  const { page = 1, pageSize = 10, search } = params;
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (search) queryParams.set('search', search);

  return useQuery({
    queryKey: ['enrollments', params],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/payments/enrollments?${queryParams.toString()}`
      );
      const raw = res.data;
      let enrollments: Enrollment[] = [];
      let total = 0;

      if (Array.isArray(raw)) {
        enrollments = raw.map((e) => mapEnrollment(e as Record<string, unknown>));
        total =
          (res.meta as { total?: number } | undefined)?.total ?? enrollments.length;
      } else if (raw && typeof raw === 'object' && 'enrollments' in (raw as object)) {
        const wrapped = raw as {
          enrollments: Record<string, unknown>[];
          total: number;
        };
        enrollments = wrapped.enrollments.map(mapEnrollment);
        total = wrapped.total;
      }

      return { enrollments, total };
    },
  });
}

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: CreateEnrollmentInput
    ): Promise<EnrollmentGenerationResult> => {
      const res = await apiClient.post<unknown>('/payments/enrollments', {
        childId: data.childId,
        branchId: data.branchId,
        academicYearId: data.academicYearId,
        startDate: data.startDate,
        recurringFee: data.recurringFee,
        registrationFee: data.registrationFee,
        firstPeriodAmountDue: data.firstPeriodAmountDue,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to create enrollment');
      }
      const d = res.data as Record<string, unknown>;
      return {
        enrollmentId: d.enrollmentId as string,
        periodsCreated: d.periodsCreated as number,
        earliestPeriodStart: d.earliestPeriodStart as string,
        latestPeriodEnd: d.latestPeriodEnd as string,
        totalAmountDue: d.totalAmountDue as string,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export interface BillingPeriod {
  id: string;
  enrollmentId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  graceEndDate: string;
  amountDue: string;
  isRegistrationPeriod: boolean;
  cancelledAt: string | null;
  status?: 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
  totalPaid?: string;
  outstanding?: string;
  isLate?: boolean;
}

export interface EnrollmentDetail extends Enrollment {
  billingPeriods: BillingPeriod[];
}

export interface WithdrawEnrollmentInput {
  withdrawalDate: string;
  amountDue?: number;
}

export function useEnrollmentDetail(enrollmentId: string) {
  return useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/payments/enrollments/${enrollmentId}`
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to fetch enrollment');
      }
      const raw = res.data as Record<string, unknown>;
      const enrollment = mapEnrollment(raw) as EnrollmentDetail;

      // Map billing periods
      const rawPeriods = (raw.billingPeriods ?? raw.billing_periods ?? []) as Record<string, unknown>[];
      enrollment.billingPeriods = rawPeriods.map((p) => ({
        id: p.id as string,
        enrollmentId: (p.enrollmentId ?? p.enrollment_id) as string,
        periodStart: (p.periodStart ?? p.period_start) as string,
        periodEnd: (p.periodEnd ?? p.period_end) as string,
        dueDate: (p.dueDate ?? p.due_date) as string,
        graceEndDate: (p.graceEndDate ?? p.grace_end_date) as string,
        amountDue: (p.amountDue ?? p.amount_due ?? '0') as string,
        isRegistrationPeriod: (p.isRegistrationPeriod ?? p.is_registration_period ?? false) as boolean,
        cancelledAt: (p.cancelledAt ?? p.cancelled_at ?? null) as string | null,
        status: (p.status as BillingPeriod['status']) ?? undefined,
        totalPaid: (p.totalPaid ?? p.total_paid ?? undefined) as string | undefined,
        outstanding: (p.outstanding ?? undefined) as string | undefined,
        isLate: (p.isLate ?? p.is_late ?? undefined) as boolean | undefined,
      }));

      return enrollment;
    },
    enabled: !!enrollmentId,
  });
}

export function useWithdrawEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      enrollmentId,
      data,
    }: {
      enrollmentId: string;
      data: WithdrawEnrollmentInput;
    }) => {
      const res = await apiClient.post<unknown>(
        `/payments/enrollments/${enrollmentId}/withdraw`,
        data
      );
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to withdraw enrollment');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['enrollment', variables.enrollmentId] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/payments/branches');
      const raw = res.data;
      if (Array.isArray(raw)) {
        return raw.map((b) => {
          const branch = b as Record<string, unknown>;
          return {
            id: branch.id as string,
            name: branch.name as string,
          };
        });
      }
      if (raw && typeof raw === 'object' && 'branches' in (raw as object)) {
        const wrapped = raw as { branches: Record<string, unknown>[] };
        return wrapped.branches.map((b) => ({
          id: b.id as string,
          name: b.name as string,
        }));
      }
      return [];
    },
  });
}
