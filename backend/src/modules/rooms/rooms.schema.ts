import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(100, 'Room name must not exceed 100 characters'),
  capacity: z.number().int('Capacity must be an integer').positive('Capacity must be a positive integer').max(500, 'Capacity must not exceed 500').nullable().optional(),
  location: optionalText(100),
  notes: optionalText(500),
});

export const updateRoomSchema = createRoomSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
