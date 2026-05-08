import { z } from 'zod';

/**
 * Zod schema for validating UUID v4 format.
 * Used to validate all ID parameters in route paths.
 */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

/**
 * Zod schema for validating pagination query parameters.
 * Provides sensible defaults: page=1, pageSize=20.
 * Constrains pageSize to a maximum of 100.
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'Page size must be at least 1').max(100, 'Page size must not exceed 100')),
});

/**
 * Schema for validating a single UUID route parameter (e.g., :id).
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
