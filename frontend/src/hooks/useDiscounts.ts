import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type DiscountType = 'scholarship' | 'sibling' | 'staff' | 'custom';

export interface Discount {
  id: string;
  enrollmentId: string;
  type: DiscountType;
  percentage: string;
  description: string | null;
  validFrom: string;
  validTo: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface CreateDiscountInput {
  type: DiscountType;
  percentage: number;
  description?: string | null;
  validFrom: string;
  validTo?: string | null;
}

export type UpdateDiscountInput = Partial<CreateDiscountInput>;

export function useDiscounts(enrollmentId: string) {
  return useQuery({
    queryKey: ['discounts', enrollmentId],
    queryFn: async () => {
      const res = await apiClient.get<Discount[]>(`/payments/enrollments/${enrollmentId}/discounts`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!enrollmentId,
  });
}

export function useCreateDiscount(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDiscountInput) => {
      const res = await apiClient.post<Discount>(
        `/payments/enrollments/${enrollmentId}/discounts`,
        input,
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create discount');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts', enrollmentId] });
      qc.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    },
  });
}

export function useUpdateDiscount(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDiscountInput & { id: string }) => {
      const res = await apiClient.put<Discount>(`/payments/discounts/${id}`, input);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update discount');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts', enrollmentId] });
      qc.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    },
  });
}

export function useDeleteDiscount(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/payments/discounts/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to delete discount');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts', enrollmentId] });
      qc.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    },
  });
}
