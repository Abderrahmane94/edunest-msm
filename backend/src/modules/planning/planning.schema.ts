import { z } from 'zod';
import { isoDateSchema, uuidSchema } from '../../utils/validators';

export const ABSENCE_REASONS = ['illness', 'leave', 'unpaid', 'training', 'other'] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'A time is written HH:MM');

export const shiftsSchema = z.object({
  shifts: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        week: z.enum(['all', 'a', 'b']),
        start: time,
        end: time,
      }),
    )
    .max(28),
});

const absenceFields = {
  userId: uuidSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  reason: z.enum(ABSENCE_REASONS),
  note: z.string().trim().max(500).nullable().optional(),
};

const ordered = (a: { startDate?: string; endDate?: string }) => !a.startDate || !a.endDate || a.startDate <= a.endDate;
const END_FIRST = { message: 'The end date cannot be before the start date', path: ['endDate'] };

export const createAbsenceSchema = z.object(absenceFields).refine(ordered, END_FIRST);
export const updateAbsenceSchema = z
  .object({ startDate: absenceFields.startDate, endDate: absenceFields.endDate, reason: absenceFields.reason, note: absenceFields.note })
  .partial()
  .refine(ordered, END_FIRST);

export const weekQuerySchema = z.object({ start: isoDateSchema.optional() });
export const absencesQuerySchema = z.object({ from: isoDateSchema, to: isoDateSchema, userId: uuidSchema.optional() });
export const summaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'),
  userId: uuidSchema.optional(),
});
export const userParamSchema = z.object({ userId: uuidSchema });

export type ShiftsInput = z.infer<typeof shiftsSchema>;
export type CreateAbsenceInput = z.infer<typeof createAbsenceSchema>;
export type UpdateAbsenceInput = z.infer<typeof updateAbsenceSchema>;
