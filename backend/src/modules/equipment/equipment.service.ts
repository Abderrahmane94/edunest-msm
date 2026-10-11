import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type { CreateEquipmentInput, UpdateEquipmentInput } from './equipment.schema';

export class EquipmentServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'EquipmentServiceError';
  }
}

const include = { room: { select: { id: true, name: true } } };

class EquipmentService {
  /** The school's equipment, by name, with its room. */
  list(schoolId: string) {
    return prisma.equipment.findMany({ where: { schoolId }, orderBy: { name: 'asc' }, include });
  }

  /** How many pieces of equipment need repairing (dashboard). */
  async toRepairCount(schoolId: string): Promise<number> {
    const r = await prisma.equipment.aggregate({ where: { schoolId, condition: 'repair' }, _sum: { quantity: true } });
    return r._sum.quantity ?? 0;
  }

  async create(schoolId: string, input: CreateEquipmentInput) {
    if (input.roomId) await this.assertRoom(schoolId, input.roomId);
    return prisma.equipment.create({
      data: {
        schoolId,
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        condition: input.condition,
        roomId: input.roomId ?? null,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        unitValue: input.unitValue != null ? new Prisma.Decimal(input.unitValue) : null,
        notes: input.notes || null,
      },
      include,
    });
  }

  async update(id: string, schoolId: string, input: UpdateEquipmentInput) {
    await this.find(id, schoolId);
    if (input.roomId) await this.assertRoom(schoolId, input.roomId);
    return prisma.equipment.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.quantity !== undefined && { quantity: input.quantity }),
        ...(input.condition !== undefined && { condition: input.condition }),
        ...(input.roomId !== undefined && { roomId: input.roomId }),
        ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null }),
        ...(input.unitValue !== undefined && { unitValue: input.unitValue != null ? new Prisma.Decimal(input.unitValue) : null }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
      },
      include,
    });
  }

  /** Given away or thrown out: removed from the list. */
  async delete(id: string, schoolId: string) {
    await this.find(id, schoolId);
    await prisma.equipment.delete({ where: { id } });
  }

  private async find(id: string, schoolId: string) {
    const item = await prisma.equipment.findFirst({ where: { id, schoolId } });
    if (!item) throw new EquipmentServiceError('Equipment not found', 404);
    return item;
  }

  private async assertRoom(schoolId: string, roomId: string) {
    if (!(await prisma.room.findFirst({ where: { id: roomId, schoolId }, select: { id: true } }))) {
      throw new EquipmentServiceError('Room not found', 404);
    }
  }
}

export const equipmentService = new EquipmentService();
