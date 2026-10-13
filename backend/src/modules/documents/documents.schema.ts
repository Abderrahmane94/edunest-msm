import { z } from 'zod';

export const DOCUMENT_CATEGORIES = ['enrollment', 'health', 'rules', 'other'] as const;

/** A form field sent beside a file: "true" / "false". */
const flag = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
/** An optional text sent beside a file: empty means none. */
const note = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(500).nullable());

export const documentFieldsSchema = z.object({
  name: z.string().trim().min(2, 'A document needs a name').max(120),
  category: z.enum(DOCUMENT_CATEGORIES),
  note: note.optional(),
  visibleToParents: flag.default(false),
});

export const documentUpdateSchema = z.object({
  name: z.string().trim().min(2, 'A document needs a name').max(120).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  note: note.optional(),
  visibleToParents: flag.optional(),
});

export type DocumentFields = z.infer<typeof documentFieldsSchema>;
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
