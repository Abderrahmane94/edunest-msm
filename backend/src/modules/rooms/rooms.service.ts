import prisma from '../../lib/prisma';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schema';

export class RoomServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'RoomServiceError';
  }
}

/** Blank optional text is stored as no value. */
function orNull(value: string | null | undefined): string | null | undefined {
  return value === undefined ? undefined : value?.trim() || null;
}

class RoomsService {
  /**
   * The school's rooms, by name, each with the classes placed in it — those of
   * one school year when `academicYearId` is given — and their children count.
   */
  async list(schoolId: string, academicYearId?: string) {
    const rooms = await prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      include: {
        classrooms: {
          where: academicYearId ? { academicYearId } : undefined,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            capacity: true,
            academicYearId: true,
            workingDays: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
    });

    return rooms.map(({ classrooms, ...room }) => ({
      ...room,
      classrooms: classrooms.map(({ _count, ...classroom }) => ({
        ...classroom,
        enrolledCount: _count.enrollments,
      })),
    }));
  }

  async create(schoolId: string, input: CreateRoomInput) {
    await this.assertNameFree(schoolId, input.name);
    return prisma.room.create({
      data: {
        schoolId,
        name: input.name.trim(),
        capacity: input.capacity ?? null,
        location: orNull(input.location) ?? null,
        notes: orNull(input.notes) ?? null,
      },
    });
  }

  async update(id: string, schoolId: string, input: UpdateRoomInput) {
    await this.getOwned(id, schoolId);
    if (input.name !== undefined) await this.assertNameFree(schoolId, input.name, id);
    return prisma.room.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.location !== undefined && { location: orNull(input.location) }),
        ...(input.notes !== undefined && { notes: orNull(input.notes) }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /** Only a room no class has ever used can go; the others are deactivated instead. */
  async delete(id: string, schoolId: string): Promise<void> {
    await this.getOwned(id, schoolId);
    const used = await prisma.classroom.count({ where: { roomId: id } });
    if (used > 0) {
      throw new RoomServiceError('Cannot delete a room used by a class: deactivate it instead', 409);
    }
    await prisma.room.delete({ where: { id } });
  }

  /**
   * Checks a room a class is placed in: it must belong to the school and be
   * active — unless the class is already in it (`currentRoomId`).
   */
  async assertAssignable(roomId: string, schoolId: string, currentRoomId?: string | null): Promise<void> {
    const room = await prisma.room.findFirst({ where: { id: roomId, schoolId } });
    if (!room) throw new RoomServiceError('Room not found', 404);
    if (!room.isActive && room.id !== currentRoomId) {
      throw new RoomServiceError('Room is inactive', 400);
    }
  }

  private async getOwned(id: string, schoolId: string) {
    const room = await prisma.room.findFirst({ where: { id, schoolId } });
    if (!room) throw new RoomServiceError('Room not found', 404);
    return room;
  }

  private async assertNameFree(schoolId: string, name: string, exceptId?: string): Promise<void> {
    const clash = await prisma.room.findFirst({
      where: {
        schoolId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
    });
    if (clash) throw new RoomServiceError(`A room named "${clash.name}" already exists`, 409);
  }
}

export const roomsService = new RoomsService();
