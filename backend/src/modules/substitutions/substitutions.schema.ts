import { z } from 'zod';
import { isoDateSchema, personNameSchema, phoneSchema } from '../../utils/validators';

export const SUBSTITUTION_REASONS = ['illness', 'leave', 'training', 'other'] as const;

const date = isoDateSchema;

export const createSubstitutionSchema = z
  .object({
    classroomId: z.string().guid(),
    /** null: nobody takes the class those days. */
    substituteUserId: z.string().guid().nullable(),
    /** A substitute from outside the school: a teacher account made with the replacement. */
    newSubstitute: z
      .object({
        firstName: personNameSchema(100),
        lastName: personNameSchema(100),
        email: z.string().trim().email(),
        phone: phoneSchema(30).optional(),
      })
      .optional(),
    startDate: date,
    endDate: date,
    reason: z.enum(SUBSTITUTION_REASONS),
    note: z.string().trim().max(500).optional(),
    /** Tell the class's parents who takes the class. */
    notifyParents: z.boolean().default(false),
    /** Go ahead although the substitute already replaces elsewhere on those days. */
    allowBusySubstitute: z.boolean().default(false),
  })
  .refine((d) => d.startDate <= d.endDate, { message: 'The end date must be on or after the start date', path: ['endDate'] });

export const updateSubstitutionSchema = z
  .object({
    substituteUserId: z.string().guid().nullable().optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    reason: z.enum(SUBSTITUTION_REASONS).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    allowBusySubstitute: z.boolean().default(false),
  })
  .refine((d) => !d.startDate || !d.endDate || d.startDate <= d.endDate, { message: 'The end date must be on or after the start date', path: ['endDate'] });

export type CreateSubstitutionInput = z.infer<typeof createSubstitutionSchema>;
export type UpdateSubstitutionInput = z.infer<typeof updateSubstitutionSchema>;
