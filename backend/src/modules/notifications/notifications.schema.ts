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

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
