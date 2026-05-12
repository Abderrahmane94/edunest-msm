import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

/**
 * Schema for a single attendance record within a bulk mark request.
 */
const attendanceRecordItemSchema = z.object({
  childId: uuidSchema,
  status: z.enum(['present', 'absent', 'late'], {
    errorMap: () => ({ message: 'Status must be one of: present, absent, late' }),
  }),
  note: z.string().max(500, 'Note must not exceed 500 characters').optional(),
});

/**
 * Schema for the bulk attendance marking request body.
 */
export const bulkMarkAttendanceSchema = z.object({
  classroomId: uuidSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  records: z
    .array(attendanceRecordItemSchema)
    .min(1, 'At least one attendance record is required'),
});

/**
 * Schema for updating a single attendance record.
 */
export const updateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'late'], {
    errorMap: () => ({ message: 'Status must be one of: present, absent, late' }),
  }),
  note: z.string().max(500, 'Note must not exceed 500 characters').optional(),
});

/**
 * Schema for classroom attendance query params (date required).
 */
export const classroomAttendanceQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * Schema for child attendance history query params.
 */
export const childAttendanceQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional(),
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
    .pipe(z.number().int().min(1).max(100, 'Page size must not exceed 100')),
});

/**
 * Param schema for classroomId route parameter.
 */
export const classroomIdParamSchema = z.object({
  classroomId: uuidSchema,
});

/**
 * Param schema for childId route parameter.
 */
export const childIdParamSchema = z.object({
  childId: uuidSchema,
});

/**
 * Schema for attendance report query params (month + year).
 */
export const attendanceReportQuerySchema = z.object({
  month: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12')),
  year: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be 2100 or earlier')),
});

export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type ClassroomAttendanceQuery = z.infer<typeof classroomAttendanceQuerySchema>;
export type ChildAttendanceQuery = z.infer<typeof childAttendanceQuerySchema>;
export type AttendanceReportQuery = z.infer<typeof attendanceReportQuerySchema>;

/**
 * Schema for parent children attendance query params (month in YYYY-MM format).
 */
export const parentChildrenMonthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
});

export type ParentChildrenMonthQuery = z.infer<typeof parentChildrenMonthQuerySchema>;
