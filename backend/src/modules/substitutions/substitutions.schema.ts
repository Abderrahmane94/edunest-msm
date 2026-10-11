import { z } from 'zod';

export const SUBSTITUTION_REASONS = ['illness', 'leave', 'training', 'other'] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const createSubstitutionSchema = z
  .object({
    classroomId: z.string().uuid(),
    /** null: nobody takes the class those days. */
    substituteUserId: z.string().uuid().nullable(),
    /** A substitute from outside the school: a teacher account made with the replacement. */
    newSubstitute: z
      .object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        email: z.string().trim().email(),
        phone: z.string().trim().max(30).optional(),
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
    substituteUserId: z.string().uuid().nullable().optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    reason: z.enum(SUBSTITUTION_REASONS).optional(),
    note: z.string().trim().max(500).nullable().optional(),
    allowBusySubstitute: z.boolean().default(false),
  });

export type CreateSubstitutionInput = z.infer<typeof createSubstitutionSchema>;
export type UpdateSubstitutionInput = z.infer<typeof updateSubstitutionSchema>;
