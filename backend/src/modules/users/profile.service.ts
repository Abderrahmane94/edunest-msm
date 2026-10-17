import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { UserServiceError } from './users.service';

/**
 * "Mon profil": what every account changes about itself — its names, its
 * phone, its photo. The email and the role stay with the director.
 */
export interface MyProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
}

const profileSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true, role: true, avatarPublicId: true,
} as const;

function toProfile(user: { avatarPublicId: string | null } & Omit<MyProfile, 'avatarUrl'>): MyProfile {
  const { avatarPublicId, ...rest } = user;
  return { ...rest, avatarUrl: avatarPublicId ? cloudinaryService.generateSignedUrl(avatarPublicId, 'photo') : null };
}

/**
 * Where a photo is kept. Under schools/ like every other file, so the nightly
 * copy (scripts/files-backup.mjs) takes it; the platform's own accounts have
 * no school and go to schools/platform.
 */
export function avatarFolder(schoolId: string | null): string {
  return `schools/${schoolId ?? 'platform'}/avatars`;
}

async function findSelf(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new UserServiceError('User not found', 404);
  return user;
}

export const profileService = {
  async get(userId: string): Promise<MyProfile> {
    return toProfile(await findSelf(userId));
  },

  async update(userId: string, input: { firstName?: string; lastName?: string; phone?: string | null }): Promise<MyProfile> {
    await findSelf(userId);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.phone !== undefined && { phone: input.phone }),
      },
      select: profileSelect,
    });
    return toProfile(updated);
  },

  async setAvatar(userId: string, schoolId: string | null, file: Buffer, mimeType: string): Promise<MyProfile> {
    const user = await findSelf(userId);
    const stored = await cloudinaryService.uploadFile(file, {
      folder: avatarFolder(schoolId),
      resourceType: 'image',
      accessMode: 'authenticated',
      mimeType,
    });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarPublicId: stored.publicId },
      select: profileSelect,
    });
    // The old photo goes once the new one is in place.
    if (user.avatarPublicId) await cloudinaryService.deleteFile(user.avatarPublicId).catch(() => undefined);
    return toProfile(updated);
  },

  async removeAvatar(userId: string): Promise<MyProfile> {
    const user = await findSelf(userId);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarPublicId: null },
      select: profileSelect,
    });
    if (user.avatarPublicId) await cloudinaryService.deleteFile(user.avatarPublicId).catch(() => undefined);
    return toProfile(updated);
  },
};
