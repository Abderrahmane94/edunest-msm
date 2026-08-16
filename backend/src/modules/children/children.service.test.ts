import { describe, it, expect, vi, beforeEach } from 'vitest';
import { childrenService } from './children.service';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    child: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    academicYear: {
      findFirst: vi.fn(),
    },
    classroom: {
      findFirst: vi.fn(),
    },
    classroomEnrollment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    parentChildLink: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    emergencyContact: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  softDeleteStorage: {
    run: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
    getStore: vi.fn(),
  },
}));

// Mock SoftDeleteService
vi.mock('../../services/soft-delete.service', () => ({
  softDeleteService: {
    softDelete: vi.fn(),
  },
}));

// Mock Cloudinary service
vi.mock('../../services/cloudinary.service', () => ({
  cloudinaryService: {
    uploadFile: vi.fn(),
    generateSignedUrl: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { softDeleteService } from '../../services/soft-delete.service';

const mockPrisma = prisma as unknown as {
  child: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  academicYear: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  classroom: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  classroomEnrollment: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  parentChildLink: {
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  emergencyContact: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockCloudinary = cloudinaryService as unknown as {
  uploadFile: ReturnType<typeof vi.fn>;
  generateSignedUrl: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
};

const mockSoftDelete = softDeleteService as unknown as {
  softDelete: ReturnType<typeof vi.fn>;
};

describe('ChildrenService', () => {
  const schoolId = 'school-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a child when academic year belongs to the school', async () => {
      const input = {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '2019-05-15',
        gender: 'male' as const,
        enrollmentDate: '2024-09-01',
        academicYearId: 'ay-1',
      };

      const academicYear = { id: 'ay-1', schoolId };
      const expected = {
        id: 'child-1',
        schoolId,
        academicYearId: 'ay-1',
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: new Date('2019-05-15'),
        gender: 'male',
        photoPublicId: null,
        enrollmentDate: new Date('2024-09-01'),
        learnerType: 'child',
        isActive: true,
        createdAt: new Date(),
        enrollments: [],
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);
      mockPrisma.child.create.mockResolvedValue(expected);

      const result = await childrenService.create(schoolId, input);

      expect(mockPrisma.academicYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'ay-1', schoolId },
      });
      expect(mockPrisma.child.create).toHaveBeenCalledWith({
        data: {
          schoolId,
          academicYearId: 'ay-1',
          firstName: 'Ahmed',
          lastName: 'Benali',
          dateOfBirth: new Date('2019-05-15'),
          gender: 'male',
          enrollmentDate: new Date('2024-09-01'),
          learnerType: 'child',
          isActive: true,
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(expected);
      expect(result.learnerType).toBe('child');
    });

    it('should throw 404 when academic year does not belong to the school', async () => {
      const input = {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '2019-05-15',
        gender: 'male' as const,
        enrollmentDate: '2024-09-01',
        academicYearId: 'ay-other',
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(childrenService.create(schoolId, input)).rejects.toMatchObject({
        message: 'Academic year not found or does not belong to this school',
        statusCode: 404,
      });
    });
  });

  describe('list', () => {
    it('should return paginated children for a school, with linked parent names', async () => {
      const children = [
        {
          id: 'child-1', schoolId, firstName: 'Ahmed', isActive: true, enrollments: [],
          parentLinks: [{ parent: { firstName: 'Karim', lastName: 'Parent' } }],
        },
        { id: 'child-2', schoolId, firstName: 'Fatima', isActive: true, enrollments: [], parentLinks: [] },
      ];

      mockPrisma.child.findMany.mockResolvedValue(children);
      mockPrisma.child.count.mockResolvedValue(2);

      const result = await childrenService.list(schoolId, 1, 20);

      expect(result.children).toEqual([
        { id: 'child-1', schoolId, firstName: 'Ahmed', isActive: true, enrollments: [], parentNames: ['Karim Parent'] },
        { id: 'child-2', schoolId, firstName: 'Fatima', isActive: true, enrollments: [], parentNames: [] },
      ]);
      expect(result.total).toBe(2);
      expect(mockPrisma.child.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('getById', () => {
    it('should return a child when found', async () => {
      const child = {
        id: 'child-1',
        schoolId,
        firstName: 'Ahmed',
        enrollments: [],
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);

      const result = await childrenService.getById('child-1', schoolId);
      expect(result).toEqual(child);
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(childrenService.getById('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  describe('softDelete', () => {
    it('should delegate to softDeleteService', async () => {
      mockSoftDelete.softDelete.mockResolvedValue(undefined);

      await childrenService.softDelete('child-1', schoolId);

      expect(mockSoftDelete.softDelete).toHaveBeenCalledWith('child', 'child-1', schoolId);
    });

    it('should propagate errors from softDeleteService', async () => {
      mockSoftDelete.softDelete.mockRejectedValue(
        Object.assign(new Error('child not found'), { statusCode: 404, name: 'SoftDeleteError' }),
      );

      await expect(childrenService.softDelete('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'child not found',
        statusCode: 404,
      });
    });
  });

  describe('enrollInClassroom', () => {
    it('should enroll a child in a classroom successfully', async () => {
      const child = { id: 'child-1', schoolId, isActive: true };
      const classroom = { id: 'cls-1', schoolId, academicYearId: 'ay-1' };
      const enrollment = {
        id: 'enr-1',
        childId: 'child-1',
        classroomId: 'cls-1',
        enrolledAt: new Date(),
        classroom: { id: 'cls-1', name: 'Class A', level: 'KG1', academicYearId: 'ay-1' },
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.classroomEnrollment.create.mockResolvedValue(enrollment);

      const result = await childrenService.enrollInClassroom('child-1', schoolId, { classroomId: 'cls-1' });

      expect(result).toEqual(enrollment);
      expect(mockPrisma.classroomEnrollment.create).toHaveBeenCalledWith({
        data: { childId: 'child-1', classroomId: 'cls-1' },
        include: {
          classroom: { select: { id: true, name: true, level: true, academicYearId: true } },
        },
      });
    });

    it('should throw 409 when child already enrolled in a classroom for the same academic year', async () => {
      const child = { id: 'child-1', schoolId, isActive: true };
      const classroom = { id: 'cls-2', schoolId, academicYearId: 'ay-1' };
      const existingEnrollment = {
        id: 'enr-1',
        childId: 'child-1',
        classroomId: 'cls-1',
        classroom: { name: 'Class A', academicYearId: 'ay-1' },
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.classroom.findFirst.mockResolvedValue(classroom);
      mockPrisma.classroomEnrollment.findFirst.mockResolvedValue(existingEnrollment);

      await expect(
        childrenService.enrollInClassroom('child-1', schoolId, { classroomId: 'cls-2' }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });

      expect(mockPrisma.classroomEnrollment.create).not.toHaveBeenCalled();
    });

    it('should throw 404 when classroom does not belong to the same school', async () => {
      const child = { id: 'child-1', schoolId, isActive: true };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.enrollInClassroom('child-1', schoolId, { classroomId: 'cls-other' }),
      ).rejects.toMatchObject({
        message: 'Classroom not found or does not belong to this school',
        statusCode: 404,
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.enrollInClassroom('nonexistent', schoolId, { classroomId: 'cls-1' }),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  describe('uploadPhoto', () => {
    it('should upload a photo and update the child record', async () => {
      const child = { id: 'child-1', schoolId, isActive: true, photoPublicId: null };
      const uploadResult = {
        publicId: 'schools/school-123/children/photo_123',
        url: 'https://res.cloudinary.com/demo/image/upload/schools/school-123/children/photo_123',
        format: 'jpg',
        bytes: 1024,
      };
      const updatedChild = {
        ...child,
        photoPublicId: uploadResult.publicId,
        enrollments: [],
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockCloudinary.uploadFile.mockResolvedValue(uploadResult);
      mockPrisma.child.update.mockResolvedValue(updatedChild);

      const result = await childrenService.uploadPhoto('child-1', schoolId, Buffer.from('fake-image'));

      expect(mockCloudinary.uploadFile).toHaveBeenCalledWith(Buffer.from('fake-image'), {
        folder: 'schools/school-123/children',
        resourceType: 'image',
        accessMode: 'authenticated',
      });
      expect(mockPrisma.child.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: { photoPublicId: uploadResult.publicId },
        include: expect.any(Object),
      });
      expect(result.photoPublicId).toBe(uploadResult.publicId);
    });

    it('should delete existing photo before uploading new one', async () => {
      const child = { id: 'child-1', schoolId, isActive: true, photoPublicId: 'old-photo-id' };
      const uploadResult = {
        publicId: 'new-photo-id',
        url: 'https://example.com/new',
        format: 'jpg',
        bytes: 2048,
      };
      const updatedChild = { ...child, photoPublicId: 'new-photo-id', enrollments: [] };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockCloudinary.deleteFile.mockResolvedValue(undefined);
      mockCloudinary.uploadFile.mockResolvedValue(uploadResult);
      mockPrisma.child.update.mockResolvedValue(updatedChild);

      await childrenService.uploadPhoto('child-1', schoolId, Buffer.from('new-image'));

      expect(mockCloudinary.deleteFile).toHaveBeenCalledWith('old-photo-id');
    });
  });

  describe('getPhotoUrl', () => {
    it('should return a signed URL with 1-hour expiry', async () => {
      const child = { id: 'child-1', schoolId, photoPublicId: 'photo-123' };
      const signedUrl = 'https://res.cloudinary.com/demo/image/authenticated/s--sig--/exp_123/photo-123';

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockCloudinary.generateSignedUrl.mockReturnValue(signedUrl);

      const result = await childrenService.getPhotoUrl('child-1', schoolId);

      expect(mockCloudinary.generateSignedUrl).toHaveBeenCalledWith('photo-123', 'photo');
      expect(result.url).toBe(signedUrl);
      expect(result.expiresIn).toBe(3600);
    });

    it('should throw 404 when child has no photo', async () => {
      const child = { id: 'child-1', schoolId, photoPublicId: null };

      mockPrisma.child.findFirst.mockResolvedValue(child);

      await expect(childrenService.getPhotoUrl('child-1', schoolId)).rejects.toMatchObject({
        message: 'Child does not have a photo',
        statusCode: 404,
      });
    });
  });

  describe('createParentLink', () => {
    const parentUser = {
      id: 'parent-1',
      schoolId: 'school-123',
      firstName: 'Amina',
      lastName: 'Benali',
      email: 'amina@example.com',
      role: 'parent',
      isActive: true,
    };

    it('should create a parent-child link successfully', async () => {
      const child = { id: 'child-1', schoolId };
      const createdLink = {
        id: 'link-1',
        childId: 'child-1',
        parentUserId: 'parent-1',
        relationship: 'mother',
        isPrimary: false,
        createdAt: new Date(),
        parent: { id: 'parent-1', firstName: 'Amina', lastName: 'Benali', email: 'amina@example.com' },
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.user.findFirst.mockResolvedValue(parentUser);
      mockPrisma.parentChildLink.count.mockResolvedValue(0);
      mockPrisma.parentChildLink.findUnique.mockResolvedValue(null);
      mockPrisma.parentChildLink.create.mockResolvedValue(createdLink);

      const result = await childrenService.createParentLink('child-1', schoolId, {
        parentUserId: 'parent-1',
        relationship: 'mother',
      });

      expect(result).toEqual(createdLink);
      expect(mockPrisma.parentChildLink.create).toHaveBeenCalledWith({
        data: {
          childId: 'child-1',
          parentUserId: 'parent-1',
          relationship: 'mother',
          isPrimary: false,
        },
        include: {
          parent: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.createParentLink('nonexistent', schoolId, {
          parentUserId: 'parent-1',
          relationship: 'mother',
        }),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when parent user not found or not in same school', async () => {
      const child = { id: 'child-1', schoolId };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.createParentLink('child-1', schoolId, {
          parentUserId: 'nonexistent-parent',
          relationship: 'father',
        }),
      ).rejects.toMatchObject({
        message: 'Parent user not found or does not belong to this school with parent role',
        statusCode: 404,
      });
    });

    it('should throw 409 when maximum 2 parent links reached', async () => {
      const child = { id: 'child-1', schoolId };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.user.findFirst.mockResolvedValue(parentUser);
      mockPrisma.parentChildLink.count.mockResolvedValue(2);

      await expect(
        childrenService.createParentLink('child-1', schoolId, {
          parentUserId: 'parent-1',
          relationship: 'guardian',
        }),
      ).rejects.toMatchObject({
        message: 'Maximum of 2 parent links per child has been reached',
        statusCode: 409,
      });
    });

    it('should throw 409 when duplicate link exists', async () => {
      const child = { id: 'child-1', schoolId };
      const existingLink = { id: 'link-1', childId: 'child-1', parentUserId: 'parent-1' };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.user.findFirst.mockResolvedValue(parentUser);
      mockPrisma.parentChildLink.count.mockResolvedValue(1);
      mockPrisma.parentChildLink.findUnique.mockResolvedValue(existingLink);

      await expect(
        childrenService.createParentLink('child-1', schoolId, {
          parentUserId: 'parent-1',
          relationship: 'mother',
        }),
      ).rejects.toMatchObject({
        message: 'This parent is already linked to this child',
        statusCode: 409,
      });
    });
  });

  describe('getParentLinks', () => {
    it('should return all parent links for a child', async () => {
      const child = { id: 'child-1', schoolId };
      const links = [
        {
          id: 'link-1',
          childId: 'child-1',
          parentUserId: 'parent-1',
          relationship: 'mother',
          isPrimary: true,
          createdAt: new Date(),
          parent: { id: 'parent-1', firstName: 'Amina', lastName: 'Benali', email: 'amina@example.com' },
        },
      ];

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findMany.mockResolvedValue(links);

      const result = await childrenService.getParentLinks('child-1', schoolId);

      expect(result).toEqual(links);
      expect(mockPrisma.parentChildLink.findMany).toHaveBeenCalledWith({
        where: { childId: 'child-1' },
        include: {
          parent: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(childrenService.getParentLinks('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  describe('removeParentLink', () => {
    it('should remove a parent-child link successfully', async () => {
      const child = { id: 'child-1', schoolId };
      const link = { id: 'link-1', childId: 'child-1', parentUserId: 'parent-1' };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(link);
      mockPrisma.parentChildLink.delete.mockResolvedValue(link);

      await childrenService.removeParentLink('child-1', schoolId, 'link-1');

      expect(mockPrisma.parentChildLink.delete).toHaveBeenCalledWith({
        where: { id: 'link-1' },
      });
    });

    it('should throw 404 when link not found', async () => {
      const child = { id: 'child-1', schoolId };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.removeParentLink('child-1', schoolId, 'nonexistent-link'),
      ).rejects.toMatchObject({
        message: 'Parent-child link not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.removeParentLink('nonexistent', schoolId, 'link-1'),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  describe('setPrimaryLink', () => {
    it('should set a link as primary and unset others', async () => {
      const child = { id: 'child-1', schoolId };
      const link = { id: 'link-1', childId: 'child-1', parentUserId: 'parent-1' };
      const updatedLink = {
        id: 'link-1',
        childId: 'child-1',
        parentUserId: 'parent-1',
        relationship: 'mother',
        isPrimary: true,
        createdAt: new Date(),
        parent: { id: 'parent-1', firstName: 'Amina', lastName: 'Benali', email: 'amina@example.com' },
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(link);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          parentChildLink: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue(updatedLink),
          },
        };
        return fn(tx);
      });

      const result = await childrenService.setPrimaryLink('child-1', schoolId, 'link-1');

      expect(result).toEqual(updatedLink);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw 404 when link not found', async () => {
      const child = { id: 'child-1', schoolId };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.parentChildLink.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.setPrimaryLink('child-1', schoolId, 'nonexistent-link'),
      ).rejects.toMatchObject({
        message: 'Parent-child link not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.setPrimaryLink('nonexistent', schoolId, 'link-1'),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  // ─── Emergency Contacts ──────────────────────────────────────────────────────

  describe('addEmergencyContact', () => {
    it('should add an emergency contact successfully', async () => {
      const child = { id: 'child-1', schoolId };
      const createdContact = {
        id: 'contact-1',
        childId: 'child-1',
        name: 'Uncle Omar',
        relationship: 'uncle',
        phone: '+213555123456',
        isAuthorizedPickup: true,
        createdAt: new Date(),
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.create.mockResolvedValue(createdContact);

      const result = await childrenService.addEmergencyContact('child-1', schoolId, {
        name: 'Uncle Omar',
        relationship: 'uncle',
        phone: '+213555123456',
        isAuthorizedPickup: true,
      });

      expect(result).toEqual(createdContact);
      expect(mockPrisma.emergencyContact.create).toHaveBeenCalledWith({
        data: {
          childId: 'child-1',
          name: 'Uncle Omar',
          relationship: 'uncle',
          phone: '+213555123456',
          isAuthorizedPickup: true,
        },
      });
    });

    it('should default isAuthorizedPickup to false when not provided', async () => {
      const child = { id: 'child-1', schoolId };
      const createdContact = {
        id: 'contact-1',
        childId: 'child-1',
        name: 'Neighbor Fatima',
        relationship: 'neighbor',
        phone: '+213555999888',
        isAuthorizedPickup: false,
        createdAt: new Date(),
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.create.mockResolvedValue(createdContact);

      const result = await childrenService.addEmergencyContact('child-1', schoolId, {
        name: 'Neighbor Fatima',
        relationship: 'neighbor',
        phone: '+213555999888',
      });

      expect(result.isAuthorizedPickup).toBe(false);
      expect(mockPrisma.emergencyContact.create).toHaveBeenCalledWith({
        data: {
          childId: 'child-1',
          name: 'Neighbor Fatima',
          relationship: 'neighbor',
          phone: '+213555999888',
          isAuthorizedPickup: false,
        },
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.addEmergencyContact('nonexistent', schoolId, {
          name: 'Uncle Omar',
          relationship: 'uncle',
          phone: '+213555123456',
        }),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  describe('getEmergencyContacts', () => {
    it('should return all emergency contacts for a child', async () => {
      const child = { id: 'child-1', schoolId };
      const contacts = [
        {
          id: 'contact-1',
          childId: 'child-1',
          name: 'Uncle Omar',
          relationship: 'uncle',
          phone: '+213555123456',
          isAuthorizedPickup: true,
          createdAt: new Date(),
        },
        {
          id: 'contact-2',
          childId: 'child-1',
          name: 'Aunt Khadija',
          relationship: 'aunt',
          phone: '+213555654321',
          isAuthorizedPickup: false,
          createdAt: new Date(),
        },
      ];

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.findMany.mockResolvedValue(contacts);

      const result = await childrenService.getEmergencyContacts('child-1', schoolId);

      expect(result).toEqual(contacts);
      expect(mockPrisma.emergencyContact.findMany).toHaveBeenCalledWith({
        where: { childId: 'child-1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.getEmergencyContacts('nonexistent', schoolId),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });
  });

  describe('updateEmergencyContact', () => {
    it('should update an emergency contact successfully', async () => {
      const child = { id: 'child-1', schoolId };
      const contact = {
        id: 'contact-1',
        childId: 'child-1',
        name: 'Uncle Omar',
        relationship: 'uncle',
        phone: '+213555123456',
        isAuthorizedPickup: false,
      };
      const updatedContact = {
        ...contact,
        isAuthorizedPickup: true,
        phone: '+213555999000',
        createdAt: new Date(),
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.findFirst.mockResolvedValue(contact);
      mockPrisma.emergencyContact.update.mockResolvedValue(updatedContact);

      const result = await childrenService.updateEmergencyContact('child-1', schoolId, 'contact-1', {
        isAuthorizedPickup: true,
        phone: '+213555999000',
      });

      expect(result).toEqual(updatedContact);
      expect(mockPrisma.emergencyContact.update).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
        data: {
          isAuthorizedPickup: true,
          phone: '+213555999000',
        },
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.updateEmergencyContact('nonexistent', schoolId, 'contact-1', {
          name: 'New Name',
        }),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when contact not found', async () => {
      const child = { id: 'child-1', schoolId };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.updateEmergencyContact('child-1', schoolId, 'nonexistent-contact', {
          name: 'New Name',
        }),
      ).rejects.toMatchObject({
        message: 'Emergency contact not found',
        statusCode: 404,
      });
    });
  });

  describe('removeEmergencyContact', () => {
    it('should remove an emergency contact successfully', async () => {
      const child = { id: 'child-1', schoolId };
      const contact = { id: 'contact-1', childId: 'child-1' };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.findFirst.mockResolvedValue(contact);
      mockPrisma.emergencyContact.delete.mockResolvedValue(contact);

      await childrenService.removeEmergencyContact('child-1', schoolId, 'contact-1');

      expect(mockPrisma.emergencyContact.delete).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.removeEmergencyContact('nonexistent', schoolId, 'contact-1'),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when contact not found', async () => {
      const child = { id: 'child-1', schoolId };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.emergencyContact.findFirst.mockResolvedValue(null);

      await expect(
        childrenService.removeEmergencyContact('child-1', schoolId, 'nonexistent-contact'),
      ).rejects.toMatchObject({
        message: 'Emergency contact not found',
        statusCode: 404,
      });
    });
  });
});
