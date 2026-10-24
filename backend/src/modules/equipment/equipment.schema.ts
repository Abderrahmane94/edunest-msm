import { z } from 'zod';
import { pastDateSchema } from '../../utils/validators';

export const EQUIPMENT_CATEGORIES = ['furniture', 'toys', 'electronics', 'safety', 'kitchen', 'outdoor', 'other'] as const;
export const EQUIPMENT_CONDITIONS = ['good', 'repair', 'broken'] as const;

const fields = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.enum(EQUIPMENT_CATEGORIES),
  quantity: z.number().int().min(1).max(100_000),
  condition: z.enum(EQUIPMENT_CONDITIONS),
  /** null: in no room (storage). */
  roomId: z.string().guid().nullable(),
  purchaseDate: pastDateSchema.nullable(),
  unitValue: z.number().min(0).max(99_999_999.99).nullable(),
  notes: z.string().trim().max(500).nullable(),
};

export const createEquipmentSchema = z.object({
  ...fields,
  quantity: fields.quantity.default(1),
  condition: fields.condition.default('good'),
  roomId: fields.roomId.optional(),
  purchaseDate: fields.purchaseDate.optional(),
  unitValue: fields.unitValue.optional(),
  notes: fields.notes.optional(),
});

export const updateEquipmentSchema = z.object(fields).partial();

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
