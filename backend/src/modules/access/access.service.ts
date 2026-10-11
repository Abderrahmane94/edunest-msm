import type { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';
import {
  FULL_PERMISSIONS,
  OFFICE_DEFAULT_PERMISSIONS,
  normalizePermissions,
  AREAS,
  type Permissions,
} from './permissions';

export class AccessServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AccessServiceError';
  }
}

const NONE: Permissions = normalizePermissions({});
export const DEFAULT_PROFILE_NAME = 'Agent administratif';

class AccessService {
  /**
   * A user's rights: everything for the director (and super_admin); their
   * profile for the office staff (the school's default one when they have
   * none); nothing for others, who keep their own rules (teachers, parents).
   */
  async permissionsOf(user: { userId: string; role: string; schoolId?: string | null }): Promise<Permissions> {
    if (user.role === 'admin' || user.role === 'super_admin') return FULL_PERMISSIONS;
    if (user.role !== 'administrative') return NONE;
    const row = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { accessProfile: { select: { permissions: true } } },
    });
    if (row?.accessProfile) return normalizePermissions(row.accessProfile.permissions);
    const fallback = user.schoolId
      ? await prisma.accessProfile.findFirst({ where: { schoolId: user.schoolId, isDefault: true }, select: { permissions: true } })
      : null;
    return fallback ? normalizePermissions(fallback.permissions) : OFFICE_DEFAULT_PERMISSIONS;
  }

  /** The school's default office profile, made when missing. */
  async ensureDefault(schoolId: string, db: DbClient = prisma) {
    const existing = await db.accessProfile.findFirst({ where: { schoolId, isDefault: true } });
    if (existing) return existing;
    return db.accessProfile.create({
      data: {
        schoolId,
        name: DEFAULT_PROFILE_NAME,
        description: 'Profil par défaut du personnel de bureau',
        permissions: OFFICE_DEFAULT_PERMISSIONS as unknown as Prisma.InputJsonValue,
        isDefault: true,
      },
    });
  }

  /** The school's profiles, default first, with the office staff on each. */
  async list(schoolId: string) {
    await this.ensureDefault(schoolId);
    const profiles = await prisma.accessProfile.findMany({
      where: { schoolId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        users: {
          where: { deletedAt: null, role: 'administrative' },
          select: { id: true, firstName: true, lastName: true, isActive: true },
          orderBy: { firstName: 'asc' },
        },
      },
    });
    return profiles.map((p) => ({ ...p, permissions: normalizePermissions(p.permissions) }));
  }

  async create(schoolId: string, input: { name: string; description?: string | null; permissions: Permissions }) {
    await this.assertNameFree(schoolId, input.name);
    const p = await prisma.accessProfile.create({
      data: {
        schoolId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        permissions: normalizePermissions(input.permissions) as unknown as Prisma.InputJsonValue,
      },
    });
    return { ...p, permissions: normalizePermissions(p.permissions) };
  }

  async update(
    id: string,
    schoolId: string,
    input: { name?: string; description?: string | null; permissions?: Permissions; isDefault?: boolean },
  ) {
    const current = await this.find(id, schoolId);
    if (input.name !== undefined) await this.assertNameFree(schoolId, input.name, id);
    if (input.isDefault === false && current.isDefault) {
      throw new AccessServiceError('Choose another default profile instead', 400);
    }
    const p = await prisma.$transaction(async (tx) => {
      // One default profile per school.
      if (input.isDefault) await tx.accessProfile.updateMany({ where: { schoolId, id: { not: id } }, data: { isDefault: false } });
      return tx.accessProfile.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description?.trim() || null }),
          ...(input.permissions !== undefined && {
            permissions: normalizePermissions(input.permissions) as unknown as Prisma.InputJsonValue,
          }),
          ...(input.isDefault && { isDefault: true }),
        },
      });
    });
    return { ...p, permissions: normalizePermissions(p.permissions) };
  }

  /** A profile is deleted; its staff get the school's default profile. */
  async delete(id: string, schoolId: string) {
    const current = await this.find(id, schoolId);
    if (current.isDefault) throw new AccessServiceError('The default profile cannot be deleted', 400);
    const fallback = await this.ensureDefault(schoolId);
    await prisma.$transaction([
      prisma.user.updateMany({ where: { accessProfileId: id }, data: { accessProfileId: fallback.id } }),
      prisma.accessProfile.delete({ where: { id } }),
    ]);
  }

  /** Gives an office staff member a profile. */
  async assign(userId: string, schoolId: string, profileId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
    if (!user) throw new AccessServiceError('User not found', 404);
    if (user.role !== 'administrative') {
      throw new AccessServiceError('Only office staff (administrative) have a profile', 400);
    }
    await this.find(profileId, schoolId);
    await prisma.user.update({ where: { id: userId }, data: { accessProfileId: profileId } });
  }

  private async find(id: string, schoolId: string) {
    const p = await prisma.accessProfile.findFirst({ where: { id, schoolId } });
    if (!p) throw new AccessServiceError('Profile not found', 404);
    return p;
  }

  private async assertNameFree(schoolId: string, name: string, exceptId?: string) {
    const same = await prisma.accessProfile.findFirst({
      where: { schoolId, name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (same) throw new AccessServiceError('A profile with this name already exists', 409);
  }
}

export const accessService = new AccessService();
export { AREAS };
