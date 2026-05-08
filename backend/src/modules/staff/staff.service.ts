import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import type { ContractType } from '@prisma/client';

export class StaffServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'StaffServiceError';
    this.statusCode = statusCode;
  }
}

export const staffService = {
  /**
   * Create a staff profile for a user within a school.
   */
  async create(
    schoolId: string,
    userId: string,
    position: string,
    contractType: ContractType,
    contractStart: string,
    contractEnd?: string,
  ) {
    // Verify the user exists and belongs to the same school
    const user = await prisma.user.findFirst({
      where: { id: userId, schoolId },
    });

    if (!user) {
      throw new StaffServiceError('User not found in this school', 404);
    }

    // Check if a staff profile already exists for this user
    const existing = await prisma.staffProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new StaffServiceError('A staff profile already exists for this user', 409);
    }

    const staffProfile = await prisma.staffProfile.create({
      data: {
        userId,
        schoolId,
        position,
        contractType,
        contractStart: new Date(contractStart),
        contractEnd: contractEnd ? new Date(contractEnd) : null,
      },
    });

    return staffProfile;
  },

  /**
   * List staff profiles in a school with pagination.
   */
  async list(schoolId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [profiles, total] = await Promise.all([
      prisma.staffProfile.findMany({
        where: { schoolId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.staffProfile.count({ where: { schoolId } }),
    ]);

    return { profiles, total };
  },

  /**
   * Get a staff profile by ID within a school.
   */
  async getById(id: string, schoolId: string) {
    const profile = await prisma.staffProfile.findFirst({
      where: { id, schoolId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!profile) {
      throw new StaffServiceError('Staff profile not found', 404);
    }

    return profile;
  },

  /**
   * Update a staff profile.
   */
  async update(
    id: string,
    schoolId: string,
    data: {
      position?: string;
      contractType?: ContractType;
      contractStart?: string;
      contractEnd?: string | null;
    },
  ) {
    const profile = await prisma.staffProfile.findFirst({
      where: { id, schoolId },
    });

    if (!profile) {
      throw new StaffServiceError('Staff profile not found', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (data.position !== undefined) {
      updateData.position = data.position;
    }
    if (data.contractType !== undefined) {
      updateData.contractType = data.contractType;
    }
    if (data.contractStart !== undefined) {
      updateData.contractStart = new Date(data.contractStart);
    }
    if (data.contractEnd !== undefined) {
      updateData.contractEnd = data.contractEnd ? new Date(data.contractEnd) : null;
    }

    const updated = await prisma.staffProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return updated;
  },

  /**
   * Upload a document for a staff profile via Cloudinary.
   */
  async uploadDocument(id: string, schoolId: string, file: Buffer) {
    const profile = await prisma.staffProfile.findFirst({
      where: { id, schoolId },
    });

    if (!profile) {
      throw new StaffServiceError('Staff profile not found', 404);
    }

    // Delete old document if exists
    if (profile.documentPublicId) {
      await cloudinaryService.deleteFile(profile.documentPublicId);
    }

    // Upload new document with authenticated access
    const result = await cloudinaryService.uploadFile(file, {
      folder: `schools/${schoolId}/staff-documents`,
      resourceType: 'raw',
      accessMode: 'authenticated',
    });

    // Update the staff profile with the new document public ID
    const updated = await prisma.staffProfile.update({
      where: { id },
      data: { documentPublicId: result.publicId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return updated;
  },

  /**
   * Generate a signed URL for accessing a staff document (24-hour expiry).
   */
  async getDocumentUrl(id: string, schoolId: string) {
    const profile = await prisma.staffProfile.findFirst({
      where: { id, schoolId },
    });

    if (!profile) {
      throw new StaffServiceError('Staff profile not found', 404);
    }

    if (!profile.documentPublicId) {
      throw new StaffServiceError('No document uploaded for this staff profile', 404);
    }

    const signedUrl = cloudinaryService.generateSignedUrl(profile.documentPublicId, 'document');

    return { url: signedUrl };
  },
};
