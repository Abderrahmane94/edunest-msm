import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

export const createClassroomSchema = z.object({
  name: z
    .string()
    .min(1, 'Classroom name is required')
    .max(255, 'Classroom name must not exceed 255 characters'),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .positive('Capacity must be a positive integer'),
  roomNumber: z
    .string()
    .max(50, 'Room number must not exceed 50 characters')
    .optional(),
  level: z
    .string()
    .max(100, 'Level must not exceed 100 characters')
    .optional(),
  academicYearId: uuidSchema,
  teacherUserId: uuidSchema.optional(),
});

export const updateClassroomSchema = z.object({
  name: z
    .string()
    .min(1, 'Classroom name is required')
    .max(255, 'Classroom name must not exceed 255 characters')
    .optional(),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .positive('Capacity must be a positive integer')
    .optional(),
  roomNumber: z
    .string()
    .max(50, 'Room number must not exceed 50 characters')
    .nullable()
    .optional(),
  level: z
    .string()
    .max(100, 'Level must not exceed 100 characters')
    .nullable()
    .optional(),
});

export const assignTeacherSchema = z.object({
  teacherUserId: uuidSchema.nullable(),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
