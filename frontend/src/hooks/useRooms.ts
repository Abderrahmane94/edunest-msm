import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiError } from '@/lib/api-client';

/** A class placed in a room, for one school year. */
export interface RoomOccupant {
  id: string;
  name: string;
  capacity: number;
  academic_year_id: string;
  working_days: string[];
  enrolled_count: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number | null;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  classrooms: RoomOccupant[];
}

export interface RoomInput {
  name: string;
  capacity: number | null;
  location: string | null;
  notes: string | null;
}

function mapRoom(raw: Record<string, unknown>): Room {
  const classrooms = (raw.classrooms as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: raw.id as string,
    name: raw.name as string,
    capacity: (raw.capacity ?? null) as number | null,
    location: (raw.location ?? null) as string | null,
    notes: (raw.notes ?? null) as string | null,
    is_active: raw.isActive as boolean,
    classrooms: classrooms.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      capacity: c.capacity as number,
      academic_year_id: c.academicYearId as string,
      working_days: (c.workingDays as string[] | undefined) ?? [],
      enrolled_count: (c.enrolledCount as number | undefined) ?? 0,
    })),
  };
}

/** The school's rooms, each with its classes of `academicYearId`. */
export function useRooms(academicYearId?: string) {
  return useQuery({
    queryKey: ['rooms', academicYearId],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>[]>(
        `/rooms${academicYearId ? `?academic_year_id=${academicYearId}` : ''}`,
      );
      if (!res.success) throw apiError(res.error, 'Failed to load rooms');
      return (res.data ?? []).map(mapRoom);
    },
  });
}

function useRoomMutation<V>(fn: (vars: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}

export function useCreateRoom() {
  return useRoomMutation(async (data: RoomInput) => {
    const res = await apiClient.post('/rooms', data);
    if (!res.success) throw apiError(res.error, 'Failed to create room');
    return res.data;
  });
}

export function useUpdateRoom() {
  return useRoomMutation(async ({ id, ...data }: Partial<RoomInput> & { id: string; isActive?: boolean }) => {
    const res = await apiClient.put(`/rooms/${id}`, data);
    if (!res.success) throw apiError(res.error, 'Failed to update room');
    return res.data;
  });
}

export function useDeleteRoom() {
  return useRoomMutation(async (id: string) => {
    const res = await apiClient.delete(`/rooms/${id}`);
    if (!res.success) throw apiError(res.error, 'Failed to delete room');
    return res.data;
  });
}
