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
 * Zod schema for user list query parameters.
 * Extends pagination with optional search and sort fields.
 * Accepts snake_case sort columns from the frontend and maps to Prisma camelCase.
 */
export const userListQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'first_name', 'last_name', 'firstName', 'lastName', 'email', 'role', 'is_active', 'isActive', 'created_at', 'createdAt']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
});

/** Map frontend sort column names to Prisma field names */
export const userSortColumnMap: Record<string, string> = {
  name: 'firstName',
  first_name: 'firstName',
  last_name: 'lastName',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  role: 'role',
  is_active: 'isActive',
  isActive: 'isActive',
  created_at: 'createdAt',
  createdAt: 'createdAt',
};

export type UserListQuery = z.infer<typeof userListQuerySchema>;

/**
 * Schema for validating a single UUID route parameter (e.g., :id).
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
