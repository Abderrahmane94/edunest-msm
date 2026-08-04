import prisma from '../../lib/prisma';
import type { UpdateWorkingDaysInput } from './timetable.schema';

export class TimetableServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'TimetableServiceError';
  }
}

class TimetableService {
  /**
   * Get working days for a classroom.
   */
  async getWorkingDays(classroomId: string, schoolId: string, requestingTeacherUserId?: string) {
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, schoolId, deletedAt: null },
      select: { id: true, name: true, workingDays: true, teacherUserId: true },
    });

    if (!classroom || (requestingTeacherUserId && classroom.teacherUserId !== requestingTeacherUserId)) {
      throw new TimetableServiceError('Classroom not found', 404);
    }

    const { teacherUserId: _teacherUserId, ...rest } = classroom;
    return rest;
  }

  /**
   * Update working days for a classroom.
   */
  async updateWorkingDays(schoolId: string, input: UpdateWorkingDaysInput) {
    const classroom = await prisma.classroom.findFirst({
      where: { id: input.classroomId, schoolId, deletedAt: null },
    });

    if (!classroom) {
      throw new TimetableServiceError('Classroom not found', 404);
    }

    const updated = await prisma.classroom.update({
      where: { id: input.classroomId },
      data: { workingDays: input.workingDays },
      select: { id: true, name: true, workingDays: true },
    });

    return updated;
  }
}

export const timetableService = new TimetableService();
