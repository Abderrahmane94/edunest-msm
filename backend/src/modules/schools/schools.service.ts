import bcrypt from 'bcrypt';
import { accessService } from '../access/access.service';
import prisma, { softDeleteStorage } from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { temporaryPassword } from '../users/users.service';
import { schoolToday } from '../admin/dashboard.service';
import { schoolYearOf } from '../../lib/school-year';
import type { CreateSchoolInput, UpdateSchoolInput, SchoolResponse } from './schools.types';
import { purgeSchool } from '../../lib/purge-school';
import { emailHasOtherAccount } from '../../lib/email-accounts';
import { trialIsOver } from '../../lib/demo';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  async create(input: CreateSchoolInput): Promise<SchoolResponse & { director: { id: string; email: string | null; phone: string | null; firstName: string; lastName: string; temporaryPassword: string; emailHasOtherAccount: boolean } }> {
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
          // On trial: open until then, closed after until it subscribes.
          trialEndsAt: input.trialDays ? new Date(Date.now() + input.trialDays * DAY_MS) : null,
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

    return {
      ...withLogoUrl(school),
      director: { ...director, temporaryPassword: password, emailHasOtherAccount: await emailHasOtherAccount(director.email, director.id) },
    };
  }

  /**
   * List all schools with pagination (super_admin only).
   */
  async list(page: number, pageSize: number): Promise<{ schools: SchoolResponse[]; total: number }> {
    const [schools, total] = await Promise.all([
      // Real schools only: demonstrations have their own list.
      prisma.school.findMany({
        where: { demoExpiresAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.school.count({ where: { demoExpiresAt: null } }),
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
  async getBrand(id: string): Promise<{ name: string; logoUrl: string | null; demoExpiresAt: string | null; trialEndsAt: string | null }> {
    const school = await prisma.school.findUnique({
      where: { id },
      select: { name: true, logoPublicId: true, demoExpiresAt: true, trialEndsAt: true },
    });

    if (!school) {
      throw new SchoolServiceError('School not found', 404);
    }

    return {
      name: school.name,
      logoUrl: school.logoPublicId ? cloudinaryService.generateSignedUrl(school.logoPublicId, 'photo') : null,
      // A demonstration: everyone in it sees until when.
      demoExpiresAt: school.demoExpiresAt?.toISOString() ?? null,
      // On trial: its office sees until when.
      trialEndsAt: school.trialEndsAt?.toISOString() ?? null,
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
   * More days of trial, from today if it is already over (its people can sign in again).
   */
  async extendTrial(id: string, days: number): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) throw new SchoolServiceError('School not found', 404);
    if (!school.trialEndsAt) throw new SchoolServiceError('This school is not on trial', 400);
    const from = Math.max(Date.now(), school.trialEndsAt.getTime());
    const updated = await prisma.school.update({ where: { id }, data: { trialEndsAt: new Date(from + days * DAY_MS) } });
    return withLogoUrl(updated);
  }

  /**
   * The director subscribed: the trial ends here, the school stays open with
   * everything entered during it (its subscription is followed in Billing).
   */
  async endTrialSubscribed(id: string): Promise<SchoolResponse> {
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) throw new SchoolServiceError('School not found', 404);
    if (!school.trialEndsAt) throw new SchoolServiceError('This school is not on trial', 400);
    const updated = await prisma.school.update({ where: { id }, data: { trialEndsAt: null } });
    return withLogoUrl(updated);
  }

  /**
   * Erases a school for good, with all its data and files: only a trial that
   * ended without subscribing, or a closed demonstration, and only when its
   * name is typed again. A school that ever paid the platform is never erased.
   */
  async purge(id: string, confirmName: string): Promise<{ name: string; rows: number; files: number }> {
    // A closed demonstration is also removed from the lists (soft-deleted): found all the same
    // (awaited inside: a Prisma query runs when awaited, and must run within the bypass).
    const school = await softDeleteStorage.run({ includeDeleted: true }, async () => await prisma.school.findUnique({ where: { id } }));
    if (!school) throw new SchoolServiceError('School not found', 404);
    const endedTrial = trialIsOver(school);
    const closedDemo = !!school.demoExpiresAt && !school.isActive;
    if (!endedTrial && !closedDemo) {
      throw new SchoolServiceError('Only a school whose trial has ended, or a closed demonstration, can be erased', 400);
    }
    if (confirmName.trim() !== school.name.trim()) {
      throw new SchoolServiceError('The name typed is not the name of this school', 400);
    }
    const paid = await prisma.subscriptionPayment.count({ where: { subscription: { schoolId: id } } });
    if (paid > 0) throw new SchoolServiceError('This school has paid a subscription: it cannot be erased', 400);

    const counts = await purgeSchool(id);
    // Its files after its rows: a file left over is harmless, a row without its file is not.
    let files = 0;
    try {
      files = await cloudinaryService.deleteFolder(`schools/${id}/`);
    } catch (error) {
      console.error(`[purge] files of school ${id} not all deleted:`, error);
    }
    return { name: school.name, rows: Object.values(counts).reduce((a, b) => a + b, 0), files };
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
