import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../utils/validators';

/**
 * Schema for listing notifications with pagination.
 */
export const listNotificationsQuerySchema = paginationSchema;

/**
 * Schema for the notification :id route parameter.
 */
export const notificationIdParamSchema = z.object({
  id: uuidSchema,
});

/** A device's push token, from Firebase in the browser. */
export const pushDeviceSchema = z.object({
  token: z.string().min(20).max(4096),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type PushDeviceInput = z.infer<typeof pushDeviceSchema>;
