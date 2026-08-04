import prisma from '../../lib/prisma';
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

    const classroom = await prisma.classroom.create({
      data: {
        schoolId,
        academicYearId: input.academicYearId,
        name: input.name,
        capacity: input.capacity,
        roomNumber: input.roomNumber || null,
        level: input.level || null,
      },
      include: {
        teacher: { select: teacherSelect },
      },
    });

    return classroom;
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
  ): Promise<{ classrooms: ClassroomWithTeacher[]; total: number }> {
    const where: Record<string, unknown> = { schoolId };
    if (teacherId) {
      where.teacherUserId = teacherId;
    }

    const [classrooms, total] = await Promise.all([
      prisma.classroom.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          teacher: { select: teacherSelect },
        },
      }),
      prisma.classroom.count({ where }),
    ]);

    return { classrooms, total };
  }

  /**
   * Get a single classroom by ID, scoped to the school.
   */
  async getById(id: string, schoolId: string, requestingTeacherUserId?: string): Promise<ClassroomWithTeacher> {
    const classroom = await prisma.classroom.findFirst({
      where: { id, schoolId },
      include: {
        teacher: { select: teacherSelect },
      },
    });

    if (!classroom) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }

    if (requestingTeacherUserId && classroom.teacherUserId !== requestingTeacherUserId) {
      throw new ClassroomServiceError('Classroom not found', 404);
    }

    return classroom;
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

    const updated = await prisma.classroom.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.roomNumber !== undefined && { roomNumber: input.roomNumber }),
        ...(input.level !== undefined && { level: input.level }),
      },
      include: {
        teacher: { select: teacherSelect },
      },
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
      const teacher = await prisma.user.findFirst({
        where: {
          id: input.teacherUserId,
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

    const updated = await prisma.classroom.update({
      where: { id },
      data: { teacherUserId: input.teacherUserId },
      include: {
        teacher: { select: teacherSelect },
      },
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
