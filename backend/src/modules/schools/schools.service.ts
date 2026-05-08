import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import type { CreateSchoolInput, UpdateSchoolInput, SchoolResponse } from './schools.types';

export class SchoolServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SchoolServiceError';
  }
}

class SchoolsService {
  /**
   * Create a new school (super_admin only).
   */
  async create(input: CreateSchoolInput): Promise<SchoolResponse> {
    const school = await prisma.school.create({
      data: {
        name: input.name,
        schoolType: input.schoolType,
        address: input.address,
        wilaya: input.wilaya,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      },
    });

    return school;
  }

  /**
   * List all schools with pagination (super_admin only).
   */
  async list(page: number, pageSize: number): Promise<{ schools: SchoolResponse[]; total: number }> {
    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.school.count(),
    ]);

    return { schools, total };
  }

  /**
   * Get a school by ID.
   */
  async getById(id: string): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    return school;
  }

  /**
   * Update a school (admin can update their own school).
   */
  async update(id: string, input: UpdateSchoolInput): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    const updated = await prisma.school.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.schoolType !== undefined && { schoolType: input.schoolType }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.wilaya !== undefined && { wilaya: input.wilaya }),
        ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
        ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
      },
    });

    return updated;
  }

  /**
   * Deactivate a school (super_admin only).
   * Sets is_active to false.
   */
  async deactivate(id: string): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    if (!school.isActive) {
      throw new SchoolServiceError('School is already deactivated', 400);
    }

    const updated = await prisma.school.update({
      where: { id },
      data: { isActive: false },
    });

    return updated;
  }

  /**
   * Upload a school logo via Cloudinary and store the public_id.
   */
  async uploadLogo(id: string, file: Buffer): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    // Delete old logo if exists
    if (school.logoPublicId) {
      await cloudinaryService.deleteFile(school.logoPublicId);
    }

    // Upload new logo
    const result = await cloudinaryService.uploadFile(file, {
      folder: `schools/${id}/logo`,
      resourceType: 'image',
      accessMode: 'authenticated',
    });

    const updated = await prisma.school.update({
      where: { id },
      data: { logoPublicId: result.publicId },
    });

    return updated;
  }
}

export const schoolsService = new SchoolsService();
