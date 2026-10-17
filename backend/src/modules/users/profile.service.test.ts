import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../services/cloudinary.service', () => ({
  cloudinaryService: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    generateSignedUrl: vi.fn((id: string) => `signed:${id}`),
  },
}));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../auth/auth.service', () => ({ authService: {} }));
vi.mock('../../lib/phone-accounts', () => ({ accountIdsWithPhone: vi.fn().mockResolvedValue([]) }));

import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { profileService, avatarFolder } from './profile.service';
import { accountIdsWithPhone } from '../../lib/phone-accounts';

const db = prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
const files = cloudinaryService as unknown as Record<'uploadFile' | 'deleteFile', ReturnType<typeof vi.fn>>;

const me = { id: 'u1', email: 'samia@example.dz' as string | null, firstName: 'Samia', lastName: 'B', phone: null as string | null, role: 'teacher', avatarPublicId: null as string | null, schoolId: 's1' };

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue(me);
  db.user.update.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...me, ...data }));
  files.deleteFile.mockResolvedValue(undefined);
});

describe('avatarFolder', () => {
  it('keeps every photo under schools/, which the nightly copy takes', () => {
    expect(avatarFolder('s1')).toBe('schools/s1/avatars');
    expect(avatarFolder(null)).toBe('schools/platform/avatars');
  });
});

describe('profileService', () => {
  it('gives the photo as a signed address, never its storage id', async () => {
    db.user.findUnique.mockResolvedValue({ ...me, avatarPublicId: 'schools/s1/avatars/a' });
    const profile = await profileService.get('u1');
    expect(profile.avatarUrl).toBe('signed:schools/s1/avatars/a');
    expect(profile).not.toHaveProperty('avatarPublicId');
  });

  it('changes only the fields sent, on the account itself', async () => {
    await profileService.update('u1', { firstName: 'Samira', phone: null });
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { firstName: 'Samira', phone: null },
    }));
  });

  it('refuses an account that no longer exists', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(profileService.update('gone', { firstName: 'X' })).rejects.toMatchObject({ statusCode: 404 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('removes the old photo only once the new one is saved', async () => {
    db.user.findUnique.mockResolvedValue({ ...me, avatarPublicId: 'old' });
    files.uploadFile.mockResolvedValue({ publicId: 'new' });
    const profile = await profileService.setAvatar('u1', 's1', Buffer.from('x'), 'image/png');
    expect(files.uploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ folder: 'schools/s1/avatars' }));
    expect(db.user.update.mock.invocationCallOrder[0]).toBeLessThan(files.deleteFile.mock.invocationCallOrder[0]);
    expect(files.deleteFile).toHaveBeenCalledWith('old');
    expect(profile.avatarUrl).toBe('signed:new');
  });

  it('keeps the old photo when the upload fails', async () => {
    db.user.findUnique.mockResolvedValue({ ...me, avatarPublicId: 'old' });
    files.uploadFile.mockRejectedValue(new Error('down'));
    await expect(profileService.setAvatar('u1', 's1', Buffer.from('x'), 'image/png')).rejects.toThrow('down');
    expect(db.user.update).not.toHaveBeenCalled();
    expect(files.deleteFile).not.toHaveBeenCalled();
  });

  it('removing the photo still succeeds when storage fails to delete it', async () => {
    db.user.findUnique.mockResolvedValue({ ...me, avatarPublicId: 'old' });
    files.deleteFile.mockRejectedValue(new Error('down'));
    const profile = await profileService.removeAvatar('u1');
    expect(profile.avatarUrl).toBeNull();
  });

  it('a phone-only account keeps a number, its own in the school', async () => {
    db.user.findUnique.mockResolvedValue({ ...me, email: null, phone: '0555123456' });
    await expect(profileService.update('u1', { phone: null })).rejects.toMatchObject({ statusCode: 400 });
    vi.mocked(accountIdsWithPhone).mockResolvedValueOnce(['someone-else']);
    await expect(profileService.update('u1', { phone: '0661 00 00 00' })).rejects.toMatchObject({ statusCode: 409 });
    vi.mocked(accountIdsWithPhone).mockResolvedValueOnce(['u1']);
    await expect(profileService.update('u1', { phone: '0555 12 34 56' })).resolves.toMatchObject({ phone: '0555 12 34 56' });
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });

  it('never gives out the school id', async () => {
    expect(await profileService.get('u1')).not.toHaveProperty('schoolId');
  });
});
