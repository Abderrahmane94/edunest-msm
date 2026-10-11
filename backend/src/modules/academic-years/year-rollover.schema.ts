import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/** Where the children of a class go: a copy made by this run, or a class the year already has. */
const classTargetSchema = z.union([
  z.object({ copyOf: uuid }),
  z.object({ classroomId: uuid }),
]);

export const yearRolloverSchema = z.object({
  /** The year everything is taken from. */
  sourceYearId: uuid,
  /** Classes of the source year copied into the new year (name may change). */
  classes: z
    .array(z.object({ sourceClassroomId: uuid, name: z.string().trim().min(1).max(255) }))
    .max(200)
    .default([]),
  /** Copy the billing calendar, one year later, where the new year has none yet. */
  copyCalendar: z.boolean().default(false),
  /** New fee amounts (fees are shared by all years: already billed amounts don't change). */
  feeAmounts: z
    .array(z.object({ feeId: uuid, amount: z.number().min(0).max(9_999_999.99) }))
    .max(200)
    .default([]),
  /** Children enrolled again, each with their class in the new year (null: none). */
  children: z
    .array(z.object({ childId: uuid, target: classTargetSchema.nullable() }))
    .max(2000)
    .default([]),
  /** Bill the children enrolled again; their fees of last year are kept where offered. */
  billing: z
    .object({
      startDate: date,
      /** Fees added for every child going to a class (key: the same targets as children). */
      extraFees: z
        .array(z.object({ target: classTargetSchema.nullable(), feeIds: z.array(uuid).max(50) }))
        .max(200)
        .default([]),
    })
    .nullable()
    .default(null),
});

export type YearRolloverInput = z.infer<typeof yearRolloverSchema>;
export type ClassTarget = z.infer<typeof classTargetSchema>;
