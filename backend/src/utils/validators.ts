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

/** The `academic_year_id` query parameter: the school year a list is limited to, if any. */
export function academicYearQuery(query: Record<string, unknown>): string | undefined {
  const value = query.academic_year_id;
  return typeof value === 'string' && uuidSchema.safeParse(value).success ? value : undefined;
}

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
  search: z.string().max(100).optional(),
  role: z.enum(['admin', 'administrative', 'teacher', 'parent']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
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

// --- What a form may send: plausible values, not only well-formed ones ---

/** Today's date (YYYY-MM-DD) wherever the user is: the latest "today" on Earth, so nobody is refused their own day. */
export function latestToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 14 * 3600 * 1000).toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  if (y < 1900 || y > 2100) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** A day that exists (no 31 February), in a plausible year. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(isRealDate, 'This is not a real date');

/** A day that exists and has come: what was paid, bought or done. */
export const pastDateSchema = isoDateSchema.refine((value) => value <= latestToday(), 'This date cannot be in the future');

/** How old a child of the school can be at most. */
export const MAX_CHILD_AGE_YEARS = 18;

export const birthDateSchema = isoDateSchema
  .refine((value) => value <= latestToday(), 'The date of birth cannot be in the future')
  .refine(
    (value) => Number(value.slice(0, 4)) >= Number(latestToday().slice(0, 4)) - MAX_CHILD_AGE_YEARS - 1,
    'The date of birth is too far in the past',
  );

/** A person's name: letters of any alphabet, at least two, no digits; spaces, hyphens, apostrophes and dots between them. */
export const personNameSchema = (max = 100) =>
  z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(max, `Name must not exceed ${max} characters`)
    .regex(/^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u, 'A name needs at least 2 letters and no digits')
    .refine((value) => (value.match(/\p{L}/gu) ?? []).length >= 2, 'A name needs at least 2 letters and no digits');

/** A phone number: digits with the usual separators, an optional leading +. */
export const phoneSchema = (max = 20) =>
  z
    .string()
    .trim()
    .max(max, `Phone number must not exceed ${max} characters`)
    .regex(/^\+?[0-9\s\-().]{6,50}$/, 'This phone number is not valid')
    .refine((value) => (value.match(/\d/g) ?? []).length >= 6, 'This phone number is not valid');

export const END_BEFORE_START = 'The end date cannot be before the start date';

/** An email that may be left empty ("" from a form counts as none). */
export const optionalEmailSchema = () =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), z.string().trim().email('Invalid email address').optional());

/** A phone number that may be left empty. */
export const optionalPhoneSchema = (max = 20) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), phoneSchema(max).optional());

/** An account signs in with its email or its phone number: it needs one of them. */
export const EMAIL_OR_PHONE = {
  check: (v: { email?: string; phone?: string }) => !!v.email || !!v.phone,
  message: { message: 'An email or a phone number is required', path: ['email'] },
};
