import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

/** The palette a class's color is taken from (the app's own colors). */
export const CLASS_COLORS = ['violet', 'sky', 'teal', 'green', 'sun', 'orange', 'pink', 'red'] as const;
const color = z.enum(CLASS_COLORS).nullable().optional();

export const createClassroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Classroom name is required')
    .max(255, 'Classroom name must not exceed 255 characters'),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .positive('Capacity must be a positive integer')
    .max(500, 'Capacity must not exceed 500'),
  roomId: uuidSchema.nullable().optional(),
  level: z
    .string()
    .max(100, 'Level must not exceed 100 characters')
    .optional(),
  academicYearId: uuidSchema,
  teacherUserId: uuidSchema.optional(),
  color,
});

export const updateClassroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Classroom name is required')
    .max(255, 'Classroom name must not exceed 255 characters')
    .optional(),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .positive('Capacity must be a positive integer')
    .max(500, 'Capacity must not exceed 500')
    .optional(),
  roomId: uuidSchema.nullable().optional(),
  level: z
    .string()
    .max(100, 'Level must not exceed 100 characters')
    .nullable()
    .optional(),
  color,
});

export const assignTeacherSchema = z.object({
  teacherUserId: uuidSchema.nullable(),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
