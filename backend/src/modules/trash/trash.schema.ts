import { z } from 'zod';

export const entityTypeEnum = z.enum(['schools', 'users', 'children', 'classrooms']);

export const trashListSchema = z.object({
  entityType: entityTypeEnum,
});

export const trashActionSchema = z.object({
  entityType: entityTypeEnum,
  id: z.string().uuid(),
});

export const trashQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type EntityType = z.infer<typeof entityTypeEnum>;
export type TrashListParams = z.infer<typeof trashListSchema>;
export type TrashActionParams = z.infer<typeof trashActionSchema>;
export type TrashQuery = z.infer<typeof trashQuerySchema>;
