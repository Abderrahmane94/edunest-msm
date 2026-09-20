import prisma from '../../lib/prisma';

export class BranchFeeClassroomServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BRANCH_FEE_CLASSROOM_ERROR',
  ) {
    super(message);
    this.name = 'BranchFeeClassroomServiceError';
  }
}

class BranchFeeClassroomService {
  /**
   * Lists every classroom in the fee's school, annotated with which of them
   * are currently linked to this fee — enough for a checkbox-list UI
   * ("link one or more classrooms to this fee").
   */
  async listForFee(branchFeeId: string) {
    const fee = await prisma.branchFee.findUnique({
      where: { id: branchFeeId },
      include: { branch: { select: { schoolId: true } } },
    });
    if (!fee) {
      throw new BranchFeeClassroomServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    const [classrooms, links] = await Promise.all([
      prisma.classroom.findMany({
        where: { schoolId: fee.branch.schoolId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      prisma.branchFeeClassroom.findMany({
        where: { branchFeeId },
        select: { classroomId: true },
      }),
    ]);

    const linkedIds = new Set(links.map((l) => l.classroomId));

    return {
      classrooms: classrooms.map((c) => ({ ...c, isLinked: linkedIds.has(c.id) })),
    };
  }

  /**
   * Replaces this fee's classroom links entirely with the given set.
   */
  async setClassrooms(branchFeeId: string, classroomIds: string[]) {
    const fee = await prisma.branchFee.findUnique({
      where: { id: branchFeeId },
      include: { branch: { select: { schoolId: true } } },
    });
    if (!fee) {
      throw new BranchFeeClassroomServiceError('Fee not found', 404, 'NOT_FOUND');
    }

    // Validate every requested classroom belongs to the fee's school
    const validClassrooms = await prisma.classroom.findMany({
      where: { id: { in: classroomIds }, schoolId: fee.branch.schoolId },
      select: { id: true },
    });

    if (validClassrooms.length !== classroomIds.length) {
      throw new BranchFeeClassroomServiceError(
        'One or more selected classrooms do not belong to this fee\'s school',
        400,
        'VALIDATION_ERROR',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.branchFeeClassroom.deleteMany({ where: { branchFeeId } });

      if (classroomIds.length > 0) {
        await tx.branchFeeClassroom.createMany({
          data: classroomIds.map((classroomId) => ({ branchFeeId, classroomId })),
        });
      }
    });

    return this.listForFee(branchFeeId);
  }

  /**
   * Lists every active fee applicable to a classroom: fees explicitly linked
   * to it, plus general fees with no classroom links at all (which apply
   * everywhere). Used to pre-filter fee choices when enrolling a child
   * already assigned to a classroom.
   */
  async listFeesForClassroom(classroomId: string) {
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      throw new BranchFeeClassroomServiceError('Classroom not found', 404, 'NOT_FOUND');
    }

    const fees = await prisma.branchFee.findMany({
      where: {
        isActive: true,
        branch: { schoolId: classroom.schoolId },
        OR: [
          { classroomAssignments: { some: { classroomId } } },
          { classroomAssignments: { none: {} } },
        ],
      },
      orderBy: { name: 'asc' },
    });

    return { fees };
  }
}

export const branchFeeClassroomService = new BranchFeeClassroomService();
