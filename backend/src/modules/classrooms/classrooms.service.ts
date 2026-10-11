import prisma from '../../lib/prisma';
import { roomsService, RoomServiceError } from '../rooms/rooms.service';
import type { CreateClassroomInput, UpdateClassroomInput, AssignTeacherInput } from './classrooms.schema';
import type { ClassroomWithTeacher } from './classrooms.types';

export class ClassroomServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ClassroomServiceError';
  }
}

const teacherSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
};

const classroomInclude = {
  teacher: { select: teacherSelect },
  room: { select: { id: true, name: true, capacity: true } },
};

class ClassroomsService {
  /**
   * Create a new classroom for a school.
   * Validates that the academic year belongs to the same school.
   */
  async create(schoolId: string, input: CreateClassroomInput): Promise<ClassroomWithTeacher> {
    // Validate academic year belongs to the same school
    const academicYear = await prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
    });

    if (!academicYear) {
      throw new ClassroomServiceError('Academic year not found or does not belong to this school', 404);
    }

    if (input.teacherUserId) {
      await this.assertValidTeacher(input.teacherUserId, schoolId);
    }
    if (input.roomId) {
      await this.assertValidRoom(input.roomId, schoolId);
    }

    const classroom = await prisma.classroom.create({
      data: {
        schoolId,
        academicYearId: input.academicYearId,
        name: input.name,
        capacity: input.capacity,
        roomId: input.roomId || null,
        level: input.level || null,
        teacherUserId: input.teacherUserId || null,
      },
      include: classroomInclude,
    });

    return classroom;
  }

  /**
   * Validates that a teacher belongs to the given school and has the active teacher role.
   */
  private async assertValidTeacher(teacherUserId: string, schoolId: string): Promise<void> {
    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherUserId,
        schoolId,
        role: 'teacher',
        isActive: true,
      },
    });

    if (!teacher) {
      throw new ClassroomServiceError(
        'Teacher not found, does not belong to this school, or is not an active teacher',
        400,
      );
    }
  }

  /** A class goes in an active room of its school (or stays in its current one). */
  private async assertValidRoom(roomId: string, schoolId: string, currentRoomId?: string | null): Promise<void> {
    try {
      await roomsService.assertAssignable(roomId, schoolId, currentRoomId);
    } catch (err) {
      if (err instanceof RoomServiceError) throw new ClassroomServiceError(err.message, err.statusCode);
      throw err;
    }
  }

  /**
   * List all classrooms for a school with pagination.
   * Optionally filter by teacher assignment.
   */
  async list(
    schoolId: string,
    page: number,
    pageSize: number,
    teacherId?: string,
    academicYearId?: string,
  ): Promise<{ classrooms: (ClassroomWithTeacher & { enrolledCount: number })[]; total: number }> {
    const where: Record<string, unknown> = { schoolId };
    if (teacherId) {
      where.teacherUserId = teacherId;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const [rows, total] = await Promise.all([
      prisma.classroom.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          ...classroomInclude,
          _count: { select: { enrollments: true } },
        },
      }),
      prisma.classroom.count({ where }),
    ]);

    // Children placed in each class, for the "enrolled / capacity" display.
    const classrooms = rows.map(({ _count, ...classroom }) => ({
      ...classroom,
      enrolledCount: _count?.enrollments ?? 0,
    }));

    return { classrooms, total };
  }

  /**
   * Get a single classroom by ID, scoped to the school.
   */
  async getById(
    id: string,
    schoolId: string,
    requestingTeacherUserId?: string,
  ): Promise<ClassroomWithTeacher & { enrolledCount: number }> {
    const row = await prisma.classroom.findFirst({
      where: { id, schoolId },
      include: { ...classroomInclude, _count: { select: { enrollments: true } } },
    });

    if (!row) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }

    if (requestingTeacherUserId && row.teacherUserId !== requestingTeacherUserId) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }

    // Children placed in the class, as in the list ("enrolled / capacity").
    const { _count, ...classroom } = row;
    return { ...classroom, enrolledCount: _count?.enrollments ?? 0 };
  }

  /**
   * Update a classroom. Only updates provided fields.
   */
  async update(id: string, schoolId: string, input: UpdateClassroomInput): Promise<ClassroomWithTeacher> {
    const classroom = await prisma.classroom.findFirst({
      where: { id, schoolId },
    });

    if (!classroom) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }
    if (input.roomId) {
      await this.assertValidRoom(input.roomId, schoolId, classroom.roomId);
    }

    const updated = await prisma.classroom.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.roomId !== undefined && { roomId: input.roomId }),
        ...(input.level !== undefined && { level: input.level }),
      },
      include: classroomInclude,
    });

    return updated;
  }

  /**
   * Assign a teacher to a classroom.
   * Validates that the teacher belongs to the same school and has the teacher role.
   * Pass null to unassign the current teacher.
   */
  async assignTeacher(id: string, schoolId: string, input: AssignTeacherInput): Promise<ClassroomWithTeacher> {
    const classroom = await prisma.classroom.findFirst({
      where: { id, schoolId },
    });

    if (!classroom) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }

    // If assigning a teacher (not unassigning)
    if (input.teacherUserId !== null) {
      await this.assertValidTeacher(input.teacherUserId, schoolId);
    }

    const updated = await prisma.classroom.update({
      where: { id },
      data: { teacherUserId: input.teacherUserId },
      include: classroomInclude,
    });

    return updated;
  }

  /**
   * Delete a classroom. Only allowed when no children are enrolled.
   */
  async delete(id: string, schoolId: string): Promise<void> {
    const classroom = await prisma.classroom.findFirst({
      where: { id, schoolId },
    });

    if (!classroom) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }

    await this.assertNoEnrollments(id);

    await prisma.classroom.delete({ where: { id } });
  }

  /**
   * Throws if the classroom has any child enrollments. Shared by both the
   * hard-delete path above and the soft-delete route used in production.
   */
  async assertNoEnrollments(classroomId: string): Promise<void> {
    const enrollmentCount = await prisma.classroomEnrollment.count({
      where: { classroomId },
    });

    if (enrollmentCount > 0) {
      throw new ClassroomServiceError(
        'Cannot delete classroom with enrolled children. Remove all enrollments first.',
        409,
      );
    }
  }
}

export const classroomsService = new ClassroomsService();
