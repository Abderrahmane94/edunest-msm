import { z } from 'zod';
import { pastDateSchema } from '../../utils/validators';

export const STOCK_CATEGORIES = ['hygiene', 'cleaning', 'stationery', 'crafts', 'food', 'other'] as const;

const quantity = z.number().min(0).max(9_999_999.99);
const date = pastDateSchema;

export const createStockItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.enum(STOCK_CATEGORIES),
  unit: z.string().trim().min(1, 'Unit is required').max(40),
  alertThreshold: quantity.default(0),
  notes: z.string().trim().max(500).nullable().optional(),
  /** What is in stock today, counted when the item is added. */
  initialQuantity: quantity.default(0),
});

export const updateStockItemSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.enum(STOCK_CATEGORIES).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  alertThreshold: quantity.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createStockMovementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('purchase'),
    quantity: quantity.refine((n) => n > 0, 'Quantity must be positive'),
    date,
    note: z.string().trim().max(500).optional(),
    /** Recorded as an expense too, when given. */
    expense: z
      .object({
        amount: z.number().positive().max(99_999_999.99),
        category: z.string().min(1).max(255).default('supplies'),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('use'),
    quantity: quantity.refine((n) => n > 0, 'Quantity must be positive'),
    date,
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    /** A count: `quantity` is what is really in stock. */
    type: z.literal('adjustment'),
    quantity,
    date,
    note: z.string().trim().max(500).optional(),
  }),
]);

export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;
export type UpdateStockItemInput = z.infer<typeof updateStockItemSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
