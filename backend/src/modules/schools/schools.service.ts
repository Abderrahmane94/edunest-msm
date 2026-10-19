import bcrypt from 'bcrypt';
import { accessService } from '../access/access.service';
import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { temporaryPassword } from '../users/users.service';
import { schoolToday } from '../admin/dashboard.service';
import { schoolYearOf } from '../../lib/school-year';
import type { CreateSchoolInput, UpdateSchoolInput, SchoolResponse } from './schools.types';

const BCRYPT_ROUNDS = 10;

export class SchoolServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SchoolServiceError';
  }
}

function withLogoUrl(school: Omit<SchoolResponse, 'logoUrl'> & { logoPublicId: string | null }): SchoolResponse {
  return {
    ...school,
    logoUrl: school.logoPublicId
      ? cloudinaryService.generateSignedUrl(school.logoPublicId, 'photo')
      : null,
  };
}

class SchoolsService {
  /**
   * Create a new school (super_admin only).
   */
  async create(input: CreateSchoolInput): Promise<SchoolResponse & { director: { id: string; email: string | null; phone: string | null; firstName: string; lastName: string; temporaryPassword: string } }> {
    // No pre-check needed: email is only unique per-school (see migration
    // 0011/0012), and this school doesn't exist yet, so the director's email
    // can't already be taken within it — the same person can direct multiple schools.
    // The director's first password, told once to the platform.
    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { school, director } = await prisma.$transaction(async (tx) => {
      const newSchool = await tx.school.create({
        data: {
          name: input.name,
          schoolType: 'kindergarten',
          address: input.address,
          wilaya: input.wilaya,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
        },
      });

      const newDirector = await tx.user.create({
        data: {
          schoolId: newSchool.id,
          firstName: input.director.firstName,
          lastName: input.director.lastName,
          email: input.director.email ?? null,
          phone: input.director.phone ?? null,
          passwordHash,
          role: 'admin',
          preferredLanguage: (input.director.preferredLanguage ?? 'fr') as any,
          isActive: true,
          mustChangePassword: true,
        },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true },
      });

      // Its office staff's default rights.
      await accessService.ensureDefault(newSchool.id, tx);

      // Ready to use: the current school year, active (dates can be changed
      // later), and where payments are recorded, reminders off until chosen.
      const year = schoolYearOf(schoolToday());
      await tx.academicYear.create({
        data: { schoolId: newSchool.id, name: year.name, startDate: new Date(year.startDate), endDate: new Date(year.endDate), isActive: true },
      });
      const branch = await tx.branch.create({ data: { schoolId: newSchool.id, name: input.name, isActive: true } });
      await tx.branchBillingConfig.create({ data: { branchId: branch.id } });
      return { school: newSchool, director: newDirector };
    });

    return { ...withLogoUrl(school), director: { ...director, temporaryPassword: password } };
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

    return { schools: schools.map(withLogoUrl), total };
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

    return withLogoUrl(school);
  }

  /**
   * What every member of a school sees of it in their header: its name and
   * logo, nothing else (contacts and subscription stay with the office).
   */
  async getBrand(id: string): Promise<{ name: string; logoUrl: string | null }> {
    const school = await prisma.school.findUnique({
      where: { id },
      select: { name: true, logoPublicId: true },
    });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    return {
      name: school.name,
      logoUrl: school.logoPublicId ? cloudinaryService.generateSignedUrl(school.logoPublicId, 'photo') : null,
    };
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
        ...(input.address !== undefined && { address: input.address }),
        ...(input.wilaya !== undefined && { wilaya: input.wilaya }),
        ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
        ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
      },
    });

    return withLogoUrl(updated);
  }

  /**
   * Activate a school (super_admin only).
   */
  async activate(id: string): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({ where: { id } });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    if (school.isActive) {
      throw new SchoolServiceError('School is already active', 400);
    }

    const updated = await prisma.school.update({
      where: { id },
      data: { isActive: true },
    });

    return withLogoUrl(updated);
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

    return withLogoUrl(updated);
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

    return { ...withLogoUrl(updated), logoUrl: result.url };
  }
}

export const schoolsService = new SchoolsService();
