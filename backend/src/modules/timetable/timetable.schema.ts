import { z } from 'zod';
import { uuidSchema } from '../../utils/validators';

const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const updateWorkingDaysSchema = z.object({
  classroomId: uuidSchema,
  workingDays: z
    .array(z.enum(validDays))
    .min(1, 'At least one working day is required')
    .max(7),
});

export const classroomIdParamSchema = z.object({
  classroomId: uuidSchema,
});

export type UpdateWorkingDaysInput = z.infer<typeof updateWorkingDaysSchema>;
