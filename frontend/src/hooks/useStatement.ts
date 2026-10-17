import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

export interface StatementLine {
  id: string;
  feeName: string | null;
  isRegistration: boolean;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  baseAmount: string;
  discount: string;
  amountDue: string;
  paid: string;
  outstanding: string;
  status: 'unpaid' | 'partial' | 'late_partial' | 'late' | 'paid';
  isLate: boolean;
}

export interface StatementPayment {
  id: string;
  receiptNumber: string;
  valueDate: string;
  channel: 'cash' | 'ccp' | 'baridimob';
  amount: string;
  isCorrection: boolean;
  referenceNote: string | null;
}

export interface StatementTotals {
  base: string;
  discount: string;
  billed: string;
  paid: string;
  outstanding: string;
  late: string;
}

export interface Statement {
  child: { id: string; firstName: string; lastName: string; classroom: string | null };
  enrolled: boolean;
  lines: StatementLine[];
  payments: StatementPayment[];
  totals: StatementTotals;
}

export interface StatementDocumentData {
  school: { name: string; address: string; wilaya: string; contactPhone: string; contactEmail: string };
  year: { id: string; name: string; startDate: string; endDate: string };
  generatedOn: string;
  parents: { firstName: string; lastName: string; email: string | null; phone: string | null; relationship: string }[];
  statements: Statement[];
  totals: StatementTotals;
  hasSiblings: boolean;
}

/** A child's statement of account for a school year (the one in progress when none is given). */
export function useStatement(childId: string | null, options: { yearId?: string; family: boolean }) {
  return useQuery({
    queryKey: ['statement', childId, options.yearId ?? 'active', options.family],
    enabled: !!childId,
    // Money: always the figures of now.
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.yearId) params.set('academic_year_id', options.yearId);
      if (options.family) params.set('family', 'true');
      const query = params.toString();
      const res = await apiClient.get<StatementDocumentData>(`/payments/children/${childId}/statement${query ? `?${query}` : ''}`);
      if (!res.success) throw apiError(res.error, 'Failed to load the statement');
      return res.data as StatementDocumentData;
    },
  });
}

export function useEmailStatement() {
  return useMutation({
    mutationFn: async (input: { childId: string; to?: string; language: 'fr' | 'ar'; family: boolean; academicYearId?: string; pdfBase64: string; pdfFileName: string }) => {
      const { childId, ...body } = input;
      const res = await apiClient.post<{ sentTo: string }>(`/payments/children/${childId}/statement/email`, body);
      if (!res.success) throw apiError(res.error, 'Failed to send the statement');
      return (res.data as { sentTo: string }).sentTo;
    },
  });
}
