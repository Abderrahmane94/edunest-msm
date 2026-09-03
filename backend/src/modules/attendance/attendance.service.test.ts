import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attendanceService, AttendanceServiceError } from './attendance.service';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    classroom: {
      findFirst: vi.fn(),
    },
    attendanceRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    child: {
      findFirst: vi.fn(),
    },
    parentChildLink: {
      findFirst: vi.fn(),
    },
    classroomEnrollment: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock notification service (absence dispatch is fire-and-forget)
vi.mock('../../services/notification.service', () => ({
  notificationService: {
    dispatchAbsenceNotifications: vi.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../../lib/prisma';
import { notificationService } from '../../services/notification.service';

const mockNotificationService = notificationService as unknown as {
  dispatchAbsenceNotifications: ReturnType<typeof vi.fn>;
};

const mockPrisma = prisma as unknown as {
  classroom: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  attendanceRecord: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  child: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  parentChildLink: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  classroomEnrollment: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('AttendanceService', () => {
  const schoolId = 'school-123';
  const userId = 'teacher-1';
  const classroomId = 'classroom-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bulkMark', () => {
    const input = {
      classroomId,
      date: '2024-03-15',
      records: [
        { childId: 'child-1', status: 'present' as const },
        { childId: 'child-2', status: 'absent' as const, note: 'Sick' },
        { childId: 'child-3', status: 'late' as const },
      ],
    };

    it('should create attendance records for all children in a transaction', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: userId };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

      const expectedRecords = input.records.map((r, i) => ({
        id: `record-${i}`,
        schoolId,
        childId: r.childId,
        classroomId,
        date: new Date('2024-03-15'),
        status: r.status,
        markedByUserId: userId,
        note: r.note || null,
        createdAt: new Date(),
        child: { id: r.childId, firstName: `First${i}`, lastName: `Last${i}` },
      }));

      mockPrisma.$transaction.mockResolvedValue(expectedRecords);

      const result = await attendanceService.bulkMark(schoolId, userId, 'teacher', input);

      expect(result).toEqual(expectedRecords);
      expect(mockPrisma.classroom.findFirst).toHaveBeenCalledWith({
        where: { id: classroomId, schoolId },
      });
      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          childId: { in: ['child-1', 'child-2', 'child-3'] },
          date: new Date('2024-03-15'),
        },
        select: { childId: true },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw 404 if classroom does not belong to the school', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.bulkMark(schoolId, userId, 'teacher', input),
      ).rejects.toThrow(AttendanceServiceError);

      await expect(
        attendanceService.bulkMark(schoolId, userId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if teacher is not assigned to the classroom', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: 'other-teacher' };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);

      await expect(
        attendanceService.bulkMark(schoolId, userId, 'teacher', input),
      ).rejects.toThrow(AttendanceServiceError);

      await expect(
        attendanceService.bulkMark(schoolId, userId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should allow admin to mark attendance for any classroom', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: 'other-teacher' };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await attendanceService.bulkMark(schoolId, userId, 'admin', input);

      expect(result).toEqual([]);
    });

    it('should throw 409 if attendance already exists for a child on that date', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: userId };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { childId: 'child-1' },
      ]);

      await expect(
        attendanceService.bulkMark(schoolId, userId, 'teacher', input),
      ).rejects.toThrow(AttendanceServiceError);

      await expect(
        attendanceService.bulkMark(schoolId, userId, 'teacher', input),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('update', () => {
    const recordId = 'record-1';
    const updateInput = { status: 'late' as const, note: 'Arrived 10 minutes late' };

    it('should update an attendance record status and note', async () => {
      const existingRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        classroom: { teacherUserId: userId },
      };
      const updatedRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        date: new Date('2024-03-15'),
        status: 'late',
        markedByUserId: userId,
        note: 'Arrived 10 minutes late',
        createdAt: new Date(),
        child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' },
        markedBy: { id: userId, firstName: 'Teacher', lastName: 'One' },
      };

      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.attendanceRecord.update.mockResolvedValue(updatedRecord);

      const result = await attendanceService.update(recordId, schoolId, userId, 'teacher', updateInput);

      expect(result).toEqual(updatedRecord);
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: recordId },
        data: {
          status: 'late',
          note: 'Arrived 10 minutes late',
        },
        include: {
          child: { select: { id: true, firstName: true, lastName: true } },
          markedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    it('should throw 404 if record does not exist', async () => {
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.update(recordId, schoolId, userId, 'teacher', updateInput),
      ).rejects.toThrow(AttendanceServiceError);

      await expect(
        attendanceService.update(recordId, schoolId, userId, 'teacher', updateInput),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if teacher is not assigned to the classroom', async () => {
      const existingRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        classroom: { teacherUserId: 'other-teacher' },
      };
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(existingRecord);

      await expect(
        attendanceService.update(recordId, schoolId, userId, 'teacher', updateInput),
      ).rejects.toThrow(AttendanceServiceError);

      await expect(
        attendanceService.update(recordId, schoolId, userId, 'teacher', updateInput),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should allow admin to update any record in their school', async () => {
      const existingRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        classroom: { teacherUserId: 'other-teacher' },
      };
      const updatedRecord = {
        ...existingRecord,
        status: 'late',
        note: 'Arrived 10 minutes late',
        child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' },
        markedBy: { id: userId, firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.attendanceRecord.update.mockResolvedValue(updatedRecord);

      const result = await attendanceService.update(recordId, schoolId, userId, 'admin', updateInput);

      expect(result).toEqual(updatedRecord);
    });

    it('should dispatch absence notifications when a record is updated to absent', async () => {
      const existingRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        status: 'present',
        classroom: { teacherUserId: userId },
      };
      const updatedRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        date: new Date('2024-03-15'),
        status: 'absent',
        markedByUserId: userId,
        note: null,
        createdAt: new Date(),
        child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' },
        markedBy: { id: userId, firstName: 'Teacher', lastName: 'One' },
      };

      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.attendanceRecord.update.mockResolvedValue(updatedRecord);

      await attendanceService.update(recordId, schoolId, userId, 'teacher', { status: 'absent' });

      expect(mockNotificationService.dispatchAbsenceNotifications).toHaveBeenCalledWith(
        'child-1',
        recordId,
        '2024-03-15',
      );
    });

    it('should NOT dispatch absence notifications when updating to a non-absent status', async () => {
      const existingRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        status: 'present',
        classroom: { teacherUserId: userId },
      };
      const updatedRecord = {
        ...existingRecord,
        date: new Date('2024-03-15'),
        status: 'late',
        note: null,
        child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' },
        markedBy: { id: userId, firstName: 'Teacher', lastName: 'One' },
      };

      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.attendanceRecord.update.mockResolvedValue(updatedRecord);

      await attendanceService.update(recordId, schoolId, userId, 'teacher', { status: 'late' });

      expect(mockNotificationService.dispatchAbsenceNotifications).not.toHaveBeenCalled();
    });

    it('should NOT re-dispatch when an already-absent record is edited', async () => {
      const existingRecord = {
        id: recordId,
        schoolId,
        childId: 'child-1',
        classroomId,
        status: 'absent',
        classroom: { teacherUserId: userId },
      };
      const updatedRecord = {
        ...existingRecord,
        date: new Date('2024-03-15'),
        status: 'absent',
        note: 'Sick note added',
        child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' },
        markedBy: { id: userId, firstName: 'Teacher', lastName: 'One' },
      };

      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.attendanceRecord.update.mockResolvedValue(updatedRecord);

      await attendanceService.update(recordId, schoolId, userId, 'teacher', {
        status: 'absent',
        note: 'Sick note added',
      });

      expect(mockNotificationService.dispatchAbsenceNotifications).not.toHaveBeenCalled();
    });
  });

  describe('getByClassroom', () => {
    it('should return attendance records for a classroom on a date', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: userId };
      const records = [
        {
          id: 'record-1',
          childId: 'child-1',
          status: 'present',
          child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' },
        },
      ];

      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);

      const result = await attendanceService.getByClassroom(
        classroomId,
        schoolId,
        userId,
        'teacher',
        '2024-03-15',
      );

      expect(result).toEqual(records);
      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          classroomId,
          schoolId,
          date: new Date('2024-03-15'),
        },
        include: {
          child: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { child: { lastName: 'asc' } },
      });
    });

    it('should throw 403 if teacher is not assigned to the classroom', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: 'other-teacher' };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);

      await expect(
        attendanceService.getByClassroom(classroomId, schoolId, userId, 'teacher', '2024-03-15'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getByChild', () => {
    const childId = 'child-1';
    const options = { page: 1, pageSize: 20 };

    it('should return attendance history for a child (admin)', async () => {
      const child = { id: childId, schoolId };
      const records = [
        {
          id: 'record-1',
          childId,
          date: new Date('2024-03-15'),
          status: 'present',
          child: { id: childId, firstName: 'Ahmed', lastName: 'Ali' },
          markedBy: { id: userId, firstName: 'Teacher', lastName: 'One' },
        },
      ];

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);
      mockPrisma.attendanceRecord.count.mockResolvedValue(1);

      const result = await attendanceService.getByChild(childId, schoolId, userId, 'admin', options);

      expect(result.records).toEqual(records);
      expect(result.total).toBe(1);
    });

    it('should throw 404 if child does not belong to the school', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getByChild(childId, schoolId, userId, 'admin', options),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if parent is not linked to the child', async () => {
      const child = { id: childId, schoolId };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getByChild(childId, schoolId, 'parent-1', 'parent', options),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should allow parent to access their linked child', async () => {
      const child = { id: childId, schoolId };
      const link = { childId, parentUserId: 'parent-1' };
      const records = [
        {
          id: 'record-1',
          childId,
          date: new Date('2024-03-15'),
          status: 'present',
          child: { id: childId, firstName: 'Ahmed', lastName: 'Ali' },
          markedBy: { id: userId, firstName: 'Teacher', lastName: 'One' },
        },
      ];

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(link);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);
      mockPrisma.attendanceRecord.count.mockResolvedValue(1);

      const result = await attendanceService.getByChild(childId, schoolId, 'parent-1', 'parent', options);

      expect(result.records).toEqual(records);
    });

    it('should throw 403 if teacher does not have the child in their classroom', async () => {
      const child = { id: childId, schoolId };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getByChild(childId, schoolId, userId, 'teacher', options),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should filter by date range when provided', async () => {
      const child = { id: childId, schoolId };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
      mockPrisma.attendanceRecord.count.mockResolvedValue(0);

      await attendanceService.getByChild(childId, schoolId, userId, 'admin', {
        ...options,
        startDate: '2024-03-01',
        endDate: '2024-03-31',
      });

      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date('2024-03-01'),
              lte: new Date('2024-03-31'),
            },
          }),
        }),
      );
    });
  });

  describe('getClassroomMonthlyReport', () => {
    it('should return monthly report with correct counts and percentage', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: userId };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);

      // Simulate 3 school days with 2 children
      const records = [
        { childId: 'child-1', date: new Date('2024-03-01'), status: 'present', child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' } },
        { childId: 'child-2', date: new Date('2024-03-01'), status: 'absent', child: { id: 'child-2', firstName: 'Sara', lastName: 'Ben' } },
        { childId: 'child-1', date: new Date('2024-03-04'), status: 'late', child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' } },
        { childId: 'child-2', date: new Date('2024-03-04'), status: 'present', child: { id: 'child-2', firstName: 'Sara', lastName: 'Ben' } },
        { childId: 'child-1', date: new Date('2024-03-05'), status: 'absent', child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' } },
        { childId: 'child-2', date: new Date('2024-03-05'), status: 'late', child: { id: 'child-2', firstName: 'Sara', lastName: 'Ben' } },
      ];

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);

      const result = await attendanceService.getClassroomMonthlyReport(classroomId, schoolId, 3, 2024);

      expect(result.classroomId).toBe(classroomId);
      expect(result.month).toBe(3);
      expect(result.year).toBe(2024);
      expect(result.totalSchoolDays).toBe(3);
      expect(result.children).toHaveLength(2);

      const child1 = result.children.find((c) => c.childId === 'child-1');
      expect(child1).toBeDefined();
      expect(child1!.presentCount).toBe(1);
      expect(child1!.absentCount).toBe(1);
      expect(child1!.lateCount).toBe(1);
      // (1 + 1) / 3 * 100 = 66.67
      expect(child1!.attendancePercentage).toBe(66.67);

      const child2 = result.children.find((c) => c.childId === 'child-2');
      expect(child2).toBeDefined();
      expect(child2!.presentCount).toBe(1);
      expect(child2!.absentCount).toBe(1);
      expect(child2!.lateCount).toBe(1);
      expect(child2!.attendancePercentage).toBe(66.67);
    });

    it('should throw 404 if classroom does not belong to the school', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getClassroomMonthlyReport(classroomId, schoolId, 3, 2024),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return zero percentage when no school days exist', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: userId };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

      const result = await attendanceService.getClassroomMonthlyReport(classroomId, schoolId, 3, 2024);

      expect(result.totalSchoolDays).toBe(0);
      expect(result.children).toHaveLength(0);
    });

    it('should calculate 100% when child is present or late every day', async () => {
      const classroom = { id: classroomId, schoolId, teacherUserId: userId };
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);

      const records = [
        { childId: 'child-1', date: new Date('2024-03-01'), status: 'present', child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' } },
        { childId: 'child-1', date: new Date('2024-03-04'), status: 'late', child: { id: 'child-1', firstName: 'Ahmed', lastName: 'Ali' } },
      ];

      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);

      const result = await attendanceService.getClassroomMonthlyReport(classroomId, schoolId, 3, 2024);

      expect(result.totalSchoolDays).toBe(2);
      const child1 = result.children.find((c) => c.childId === 'child-1');
      expect(child1!.attendancePercentage).toBe(100);
    });
  });

  describe('getChildMonthlySummary', () => {
    const childId = 'child-1';

    it('should return monthly summary for a child (admin)', async () => {
      const child = { id: childId, schoolId, firstName: 'Ahmed', lastName: 'Ali' };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({ classroomId });

      // Classroom records for totalSchoolDays (3 distinct dates)
      const classroomRecords = [
        { date: new Date('2024-03-01') },
        { date: new Date('2024-03-01') },
        { date: new Date('2024-03-04') },
        { date: new Date('2024-03-05') },
      ];

      // Child's own records
      const childRecords = [
        { status: 'present' },
        { status: 'late' },
        { status: 'absent' },
      ];

      // First findMany call is for classroom records, second is for child records
      mockPrisma.attendanceRecord.findMany
        .mockResolvedValueOnce(classroomRecords)
        .mockResolvedValueOnce(childRecords);

      const result = await attendanceService.getChildMonthlySummary(
        childId, schoolId, userId, 'admin', 3, 2024,
      );

      expect(result.childId).toBe(childId);
      expect(result.firstName).toBe('Ahmed');
      expect(result.lastName).toBe('Ali');
      expect(result.month).toBe(3);
      expect(result.year).toBe(2024);
      expect(result.totalSchoolDays).toBe(3);
      expect(result.presentCount).toBe(1);
      expect(result.absentCount).toBe(1);
      expect(result.lateCount).toBe(1);
      // (1 + 1) / 3 * 100 = 66.67
      expect(result.attendancePercentage).toBe(66.67);
    });

    it('should throw 404 if child does not belong to the school', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getChildMonthlySummary(childId, schoolId, userId, 'admin', 3, 2024),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if parent is not linked to the child', async () => {
      const child = { id: childId, schoolId, firstName: 'Ahmed', lastName: 'Ali' };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getChildMonthlySummary(childId, schoolId, 'parent-1', 'parent', 3, 2024),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 403 if teacher does not have the child in their classroom', async () => {
      const child = { id: childId, schoolId, firstName: 'Ahmed', lastName: 'Ali' };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        attendanceService.getChildMonthlySummary(childId, schoolId, userId, 'teacher', 3, 2024),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should return zero percentage when child has no enrollment', async () => {
      const child = { id: childId, schoolId, firstName: 'Ahmed', lastName: 'Ali' };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      // First call for access check (teacher) returns enrollment
      // But for the totalSchoolDays lookup, enrollment is null
      mockPrisma.classroomEnrollment.findFirst
        .mockResolvedValueOnce(null);
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

      const result = await attendanceService.getChildMonthlySummary(
        childId, schoolId, userId, 'admin', 3, 2024,
      );

      expect(result.totalSchoolDays).toBe(0);
      expect(result.attendancePercentage).toBe(0);
    });

    it('should allow parent to access their linked child summary', async () => {
      const child = { id: childId, schoolId, firstName: 'Ahmed', lastName: 'Ali' };
      const link = { childId, parentUserId: 'parent-1' };
      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(link);
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue({ classroomId });
      mockPrisma.attendanceRecord.findMany
        .mockResolvedValueOnce([{ date: new Date('2024-03-01') }])
        .mockResolvedValueOnce([{ status: 'present' }]);

      const result = await attendanceService.getChildMonthlySummary(
        childId, schoolId, 'parent-1', 'parent', 3, 2024,
      );

      expect(result.childId).toBe(childId);
      expect(result.totalSchoolDays).toBe(1);
      expect(result.presentCount).toBe(1);
      expect(result.attendancePercentage).toBe(100);
    });
  });
});
