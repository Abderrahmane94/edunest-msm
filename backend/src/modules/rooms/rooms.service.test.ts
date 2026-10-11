import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    room: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    classroom: { count: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { roomsService, RoomServiceError } from './rooms.service';

const db = prisma as unknown as {
  room: Record<'findMany' | 'findFirst' | 'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  classroom: { count: ReturnType<typeof vi.fn> };
};

const schoolId = 'school-1';
const room = { id: 'room-1', schoolId, name: 'Salle 1', capacity: 20, location: null, notes: null, isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('roomsService.list', () => {
  it('returns each room with its classes of the year and their children count', async () => {
    db.room.findMany.mockResolvedValue([
      { ...room, classrooms: [{ id: 'c1', name: 'Papillons', capacity: 18, academicYearId: 'y1', workingDays: [], _count: { enrollments: 12 } }] },
    ]);

    const rooms = await roomsService.list(schoolId, 'y1');

    expect(db.room.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId },
      include: expect.objectContaining({
        classrooms: expect.objectContaining({ where: { academicYearId: 'y1' } }),
      }),
    }));
    expect(rooms[0].classrooms[0]).toEqual(expect.objectContaining({ name: 'Papillons', enrolledCount: 12 }));
    expect(rooms[0].classrooms[0]).not.toHaveProperty('_count');
  });
});

describe('roomsService.create', () => {
  it('saves a trimmed name and blank optional text as no value', async () => {
    db.room.findFirst.mockResolvedValue(null);
    db.room.create.mockResolvedValue(room);

    await roomsService.create(schoolId, { name: '  Salle 1 ', capacity: 20, location: '  ', notes: undefined });

    expect(db.room.create).toHaveBeenCalledWith({
      data: { schoolId, name: 'Salle 1', capacity: 20, location: null, notes: null },
    });
  });

  it('refuses a name already used in the school, whatever the case', async () => {
    db.room.findFirst.mockResolvedValue(room);

    await expect(roomsService.create(schoolId, { name: 'salle 1' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'A room named "Salle 1" already exists',
    });
    expect(db.room.findFirst).toHaveBeenCalledWith({
      where: { schoolId, name: { equals: 'salle 1', mode: 'insensitive' } },
    });
    expect(db.room.create).not.toHaveBeenCalled();
  });
});

describe('roomsService.update', () => {
  it('lets a room keep its own name', async () => {
    db.room.findFirst.mockResolvedValueOnce(room).mockResolvedValueOnce(null);
    db.room.update.mockResolvedValue(room);

    await roomsService.update('room-1', schoolId, { name: 'Salle 1', isActive: false });

    expect(db.room.findFirst).toHaveBeenLastCalledWith({
      where: { schoolId, name: { equals: 'Salle 1', mode: 'insensitive' }, id: { not: 'room-1' } },
    });
    expect(db.room.update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { name: 'Salle 1', isActive: false } });
  });

  it('answers 404 for a room of another school', async () => {
    db.room.findFirst.mockResolvedValue(null);

    await expect(roomsService.update('room-x', schoolId, { capacity: 10 })).rejects.toMatchObject({ statusCode: 404 });
    expect(db.room.update).not.toHaveBeenCalled();
  });
});

describe('roomsService.delete', () => {
  it('deletes a room no class uses', async () => {
    db.room.findFirst.mockResolvedValue(room);
    db.classroom.count.mockResolvedValue(0);

    await roomsService.delete('room-1', schoolId);

    expect(db.room.delete).toHaveBeenCalledWith({ where: { id: 'room-1' } });
  });

  it('keeps a room a class uses: it must be deactivated instead', async () => {
    db.room.findFirst.mockResolvedValue(room);
    db.classroom.count.mockResolvedValue(2);

    await expect(roomsService.delete('room-1', schoolId)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.room.delete).not.toHaveBeenCalled();
  });
});

describe('roomsService.assertAssignable', () => {
  it('accepts an active room of the school', async () => {
    db.room.findFirst.mockResolvedValue(room);
    await expect(roomsService.assertAssignable('room-1', schoolId)).resolves.toBeUndefined();
  });

  it('refuses an inactive room for a class not already in it', async () => {
    db.room.findFirst.mockResolvedValue({ ...room, isActive: false });
    await expect(roomsService.assertAssignable('room-1', schoolId, 'room-2')).rejects.toBeInstanceOf(RoomServiceError);
  });

  it('lets a class stay in its room after the room is deactivated', async () => {
    db.room.findFirst.mockResolvedValue({ ...room, isActive: false });
    await expect(roomsService.assertAssignable('room-1', schoolId, 'room-1')).resolves.toBeUndefined();
  });

  it('refuses a room of another school', async () => {
    db.room.findFirst.mockResolvedValue(null);
    await expect(roomsService.assertAssignable('room-x', schoolId)).rejects.toMatchObject({ statusCode: 404 });
  });
});
