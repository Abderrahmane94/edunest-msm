import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

export const EQUIPMENT_CATEGORIES = ['furniture', 'toys', 'electronics', 'safety', 'kitchen', 'outdoor', 'other'] as const;
export const EQUIPMENT_CONDITIONS = ['good', 'repair', 'broken'] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  quantity: number;
  condition: EquipmentCondition;
  roomId: string | null;
  room: { id: string; name: string } | null;
  purchaseDate: string | null;
  /** Value of one, as a decimal string. */
  unitValue: string | null;
  notes: string | null;
}

export interface EquipmentInput {
  name: string;
  category: EquipmentCategory;
  quantity: number;
  condition: EquipmentCondition;
  roomId: string | null;
  purchaseDate: string | null;
  unitValue: number | null;
  notes: string | null;
}

export function useEquipment() {
  return useQuery({
    queryKey: ['equipment', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<Equipment[]>('/equipment');
      if (!res.success) throw apiError(res.error, 'Failed to load equipment');
      return res.data as Equipment[];
    },
  });
}

/** How many pieces of equipment need repairing (admin dashboard). */
export function useEquipmentToRepair(enabled = true) {
  return useQuery({
    queryKey: ['equipment', 'summary'],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<{ toRepair: number }>('/equipment/summary');
      if (!res.success) throw apiError(res.error, 'Failed to load');
      return (res.data as { toRepair: number }).toRepair;
    },
  });
}

function useEquipmentMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['equipment'] }),
  });
}

export function useSaveEquipment() {
  return useEquipmentMutation(async ({ id, ...input }: EquipmentInput & { id?: string }) => {
    const res = id ? await apiClient.put<Equipment>(`/equipment/${id}`, input) : await apiClient.post<Equipment>('/equipment', input);
    if (!res.success) throw apiError(res.error, 'Failed to save the equipment');
    return res.data;
  });
}

export function useDeleteEquipment() {
  return useEquipmentMutation(async (id: string) => {
    const res = await apiClient.delete(`/equipment/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to delete the equipment');
    return res.data;
  });
}
