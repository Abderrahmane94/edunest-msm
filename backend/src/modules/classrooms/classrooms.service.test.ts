import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classroomsService, ClassroomServiceError } from './classrooms.service';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    classroom: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    academicYear: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    classroomEnrollment: {
      count: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma';

const mockPrisma = prisma as unknown as {
  classroom: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  academicYear: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  classroomEnrollment: {
    count: ReturnType<typeof vi.fn>;
  };
};

describe('ClassroomsService', () => {
  const schoolId = 'school-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a classroom when academic year belongs to the school', async () => {
      const input = {
        name: 'Class A',
        capacity: 25,
        roomNumber: 'R101',
        level: 'KG1',
        academicYearId: 'ay-1',
      };

      const academicYear = { id: 'ay-1', schoolId };
      const expected = {
        id: 'cls-1',
        schoolId,
        academicYearId: 'ay-1',
        teacherUserId: null,
        name: 'Class A',
        capacity: 25,
        roomNumber: 'R101',
        level: 'KG1',
        createdAt: new Date(),
        teacher: null,
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);
      mockPrisma.classroom.create.mockResolvedValue(expected);

      const result = await classroomsService.create(schoolId, input);

      expect(mockPrisma.academicYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'ay-1', schoolId },
      });
      expect(mockPrisma.classroom.create).toHaveBeenCalledWith({
        data: {
          schoolId,
          academicYearId: 'ay-1',
          name: 'Class A',
          capacity: 25,
          roomNumber: 'R101',
          level: 'KG1',
          teacherUserId: null,
        },
        include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
      expect(result).toEqual(expected);
    });

    it('should throw 404 when academic year does not belong to the school', async () => {
      const input = {
        name: 'Class A',
        capacity: 25,
        academicYearId: 'ay-other',
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(classroomsService.create(schoolId, input)).rejects.toMatchObject({
        message: 'Academic year not found or does not belong to this school',
        statusCode: 404,
      });
    });

    it('should assign the teacher when teacherUserId is provided', async () => {
      const input = {
        name: 'Class A',
        capacity: 25,
        academicYearId: 'ay-1',
        teacherUserId: 'teacher-1',
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-1', schoolId });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'teacher-1', schoolId, role: 'teacher', isActive: true });
      mockPrisma.classroom.create.mockResolvedValue({ id: 'cls-1', teacherUserId: 'teacher-1' });

      await classroomsService.create(schoolId, input);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'teacher-1', schoolId, role: 'teacher', isActive: true },
      });
      expect(mockPrisma.classroom.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teacherUserId: 'teacher-1' }) }),
      );
    });

    it('should throw when teacherUserId does not belong to an active teacher in the school', async () => {
      const input = {
        name: 'Class A',
        capacity: 25,
        academicYearId: 'ay-1',
        teacherUserId: 'teacher-bad',
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'ay-1', schoolId });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(classroomsService.create(schoolId, input)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mockPrisma.classroom.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return paginated classrooms for a school', async () => {
      const classrooms = [
        { id: 'cls-1', schoolId, name: 'Class A', capacity: 25, teacher: null, createdAt: new Date() },
        { id: 'cls-2', schoolId, name: 'Class B', capacity: 20, teacher: null, createdAt: new Date() },
      ];

      mockPrisma.classroom.findMany.mockResolvedValue(classrooms);
      mockPrisma.classroom.count.mockResolvedValue(2);

      const result = await classroomsService.list(schoolId, 1, 20);

      expect(result.classrooms).toEqual(classrooms);
      expect(result.total).toBe(2);
      expect(mockPrisma.classroom.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
    });
  });

  describe('getById', () => {
    it('should return a classroom when found', async () => {
      const classroom = {
        id: 'cls-1',
        schoolId,
        name: 'Class A',
        capacity: 25,
        teacher: null,
        createdAt: new Date(),
      };

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);

      const result = await classroomsService.getById('cls-1', schoolId);

      expect(result).toEqual(classroom);
    });

    it('should throw 404 when classroom not found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(classroomsService.getById('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Classroom not found',
        statusCode: 404,
      });
    });
  });

  describe('assignTeacher', () => {
    it('should assign a teacher that belongs to the same school', async () => {
      const classroom = { id: 'cls-1', schoolId, name: 'Class A', capacity: 25 };
      const teacher = { id: 'teacher-1', schoolId, role: 'teacher', isActive: true };
      const updated = {
        ...classroom,
        teacherUserId: 'teacher-1',
        teacher: { id: 'teacher-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
      };

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.user.findFirst.mockResolvedValue(teacher);
      mockPrisma.classroom.update.mockResolvedValue(updated);

      const result = await classroomsService.assignTeacher('cls-1', schoolId, { teacherUserId: 'teacher-1' });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'teacher-1', schoolId, role: 'teacher', isActive: true },
      });
      expect(result.teacherUserId).toBe('teacher-1');
    });

    it('should throw error when teacher does not belong to the same school', async () => {
      const classroom = { id: 'cls-1', schoolId, name: 'Class A', capacity: 25 };

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        classroomsService.assignTeacher('cls-1', schoolId, { teacherUserId: 'teacher-other' }),
      ).rejects.toMatchObject({
        message: 'Teacher not found, does not belong to this school, or is not an active teacher',
        statusCode: 400,
      });
    });

    it('should allow unassigning a teacher by passing null', async () => {
      const classroom = { id: 'cls-1', schoolId, name: 'Class A', capacity: 25, teacherUserId: 'teacher-1' };
      const updated = { ...classroom, teacherUserId: null, teacher: null };

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.classroom.update.mockResolvedValue(updated);

      const result = await classroomsService.assignTeacher('cls-1', schoolId, { teacherUserId: null });

      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(result.teacherUserId).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a classroom with no enrollments', async () => {
      const classroom = { id: 'cls-1', schoolId, name: 'Class A', capacity: 25 };

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.classroomEnrollment.count.mockResolvedValue(0);
      mockPrisma.classroom.delete.mockResolvedValue(classroom);

      await expect(classroomsService.delete('cls-1', schoolId)).resolves.toBeUndefined();

      expect(mockPrisma.classroom.delete).toHaveBeenCalledWith({ where: { id: 'cls-1' } });
    });

    it('should throw 409 when classroom has enrolled children', async () => {
      const classroom = { id: 'cls-1', schoolId, name: 'Class A', capacity: 25 };

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.classroomEnrollment.count.mockResolvedValue(3);

      await expect(classroomsService.delete('cls-1', schoolId)).rejects.toMatchObject({
        message: 'Cannot delete classroom with enrolled children. Remove all enrollments first.',
        statusCode: 409,
      });

      expect(mockPrisma.classroom.delete).not.toHaveBeenCalled();
    });

    it('should throw 404 when classroom not found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(classroomsService.delete('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Classroom not found',
        statusCode: 404,
      });
    });
  });
});
