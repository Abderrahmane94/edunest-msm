import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma, { type DbClient } from '../../lib/prisma';
import { emailService } from '../../services/email.service';
import type { UserRole, Language } from '@prisma/client';
import type { CreateUserDirectlyInput } from './users.schema';
import { authService } from '../auth/auth.service';

const INVITATION_EXPIRY_HOURS = 48;
const BCRYPT_SALT_ROUNDS = 10;

// Easy to read out or type: no 0/O, 1/l/I.
const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Eight random characters in two groups, e.g. "K7mQ-4tzP". */
export function temporaryPassword(): string {
  const pick = () => TEMPORARY_PASSWORD_ALPHABET[crypto.randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join('');
  return `${group()}-${group()}`;
}

/** Who is resetting someone's password: schoolId null for super_admin. */
interface ResetActor {
  userId: string;
  schoolId: string | null;
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

export class UserServiceError extends Error {
  statusCode: number;
  meta?: Record<string, unknown>;

  constructor(message: string, statusCode: number, meta?: Record<string, unknown>) {
    super(message);
    this.name = 'UserServiceError';
    this.statusCode = statusCode;
    this.meta = meta;
  }
}

/**
 * Looks up a soft-deleted user with this email in this school, so callers can
 * offer "restore" instead of silently creating a disconnected duplicate that
 * loses the original's history (attendance, classrooms, audit logs, etc).
 * Uses a raw query rather than the tenant/soft-delete query-filter extension's
 * includeDeleted bypass, since that extension always scopes findFirst reads.
 */
async function findRestorableUser(email: string, schoolId: string): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE email = ${email} AND school_id = ${schoolId} AND deleted_at IS NOT NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export const usersService = {
  /**
   * Send an invitation email to a user with a one-time token.
   */
  async invite(email: string, role: UserRole, schoolId: string): Promise<{ message: string }> {
    // Check if the user already exists in this specific school — the same
    // email can belong to separate accounts in different schools.
    const existingUser = await prisma.user.findFirst({
      where: { email, schoolId },
    });

    if (existingUser) {
      throw new UserServiceError('A user with this email already exists', 409);
    }

    const deletedUser = await findRestorableUser(email, schoolId);
    if (deletedUser) {
      throw new UserServiceError(
        'A previously removed user with this email exists in this school',
        409,
        { restorable: true, deletedUserId: deletedUser.id },
      );
    }

    // Get school name for the email
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new UserServiceError('School not found', 404);
    }

    // Invalidate any existing unused invitation tokens for this email in this school
    await prisma.invitationToken.updateMany({
      where: { email, schoolId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a secure one-time token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);

    await prisma.invitationToken.create({
      data: {
        email,
        schoolId,
        role,
        token,
        expiresAt,
      },
    });

    // Send invitation email. The token is already persisted regardless — don't
    // let a transient email-provider failure fail the whole request; the admin
    // action (creating the invitation) already succeeded at this point.
    const invitationUrl = `${getFrontendUrl()}/register?token=${token}`;
    try {
      await emailService.sendInvitationEmail(email, invitationUrl, school.name, role);
    } catch (err) {
      console.error('[UsersService] Failed to send invitation email:', err);
    }

    return { message: 'Invitation sent successfully' };
  },

  /**
   * Validate an invitation token and return the invitation info.
   */
  async getInvitationInfo(token: string) {
    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new UserServiceError('Invalid invitation token', 400);
    }

    if (invitation.usedAt) {
      throw new UserServiceError('Invitation token has already been used', 400);
    }

    if (invitation.expiresAt < new Date()) {
      throw new UserServiceError('Invitation token has expired', 400);
    }

    const school = await prisma.school.findUnique({
      where: { id: invitation.schoolId },
      select: { name: true },
    });

    return {
      email: invitation.email,
      role: invitation.role,
      schoolId: invitation.schoolId,
      schoolName: school?.name,
    };
  },

  /**
   * Complete registration using an invitation token.
   */
  async register(
    token: string,
    firstName: string,
    lastName: string,
    password: string,
  ) {
    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new UserServiceError('Invalid invitation token', 400);
    }

    if (invitation.usedAt) {
      throw new UserServiceError('Invitation token has already been used', 400);
    }

    if (invitation.expiresAt < new Date()) {
      throw new UserServiceError('Invitation token has expired', 400);
    }

    // Check if user already exists in this school (race condition guard)
    const existingUser = await prisma.user.findFirst({
      where: { email: invitation.email, schoolId: invitation.schoolId },
    });

    if (existingUser) {
      throw new UserServiceError('A user with this email already exists', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create user and mark token as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          schoolId: invitation.schoolId,
          firstName,
          lastName,
          email: invitation.email,
          passwordHash,
          role: invitation.role,
        },
      });

      await tx.invitationToken.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      return newUser;
    });

    return {
      id: user.id,
      schoolId: user.schoolId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
    };
  },

  /**
   * List users with pagination, search, and sorting.
   * schoolId = null → super_admin: return all users across all schools.
   * schoolId = string → admin: return users for that school only.
   * Always excludes super_admin role users.
   */
  async list(
    schoolId: string | null,
    page: number,
    pageSize: number,
    search?: string,
    sortBy: string = 'createdAt',
    sortDir: 'asc' | 'desc' = 'desc',
    filters: { role?: 'admin' | 'administrative' | 'teacher' | 'parent'; status?: 'active' | 'inactive' } = {},
  ) {
    const skip = (page - 1) * pageSize;

    // Exclude super_admin users — they are platform-level and not school-scoped
    const where: Prisma.UserWhereInput = schoolId
      ? { schoolId, role: { not: 'super_admin' } }
      : { role: { not: 'super_admin' } };

    if (filters.status) where.isActive = filters.status === 'active';

    // Each search word must match the name, email or phone, so a full name
    // like "nadia benmansour" finds the user.
    const words = (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
    if (words.length) {
      where.AND = words.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
          { email: { contains: word, mode: 'insensitive' as const } },
          { phone: { contains: word } },
        ],
      }));
    }

    // Per role for the same search and status: the list's role chips show them.
    const byRole = await prisma.user.groupBy({ by: ['role'], where: { ...where }, _count: { _all: true } });
    const roleCounts = { admin: 0, administrative: 0, teacher: 0, parent: 0 };
    for (const g of byRole) if (g.role in roleCounts) roleCounts[g.role as keyof typeof roleCounts] = g._count._all;
    if (filters.role) where.role = filters.role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          schoolId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          fcmToken: true,
          phone: true,
          address: true,
          nationalId: true,
          preferredLanguage: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          accessProfile: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, roleCounts };
  },

  /**
   * Get a user by ID.
   * If schoolId is provided, scopes the lookup to that school (admin).
   * If null, looks up by ID only (super_admin).
   * Always includes school name for super_admin context.
   */
  async getById(id: string, schoolId: string | null) {
    const user = await prisma.user.findFirst({
      where: schoolId ? { id, schoolId } : { id },
      select: {
        id: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        accessProfile: { select: { id: true, name: true } },
        isActive: true,
        fcmToken: true,
        phone: true,
        address: true,
        nationalId: true,
        preferredLanguage: true,
        createdAt: true,
        school: {
          select: { id: true, name: true, schoolType: true },
        },
      },
    });

    if (!user) {
      throw new UserServiceError('User not found', 404);
    }

    return user;
  },

  /**
   * Activate a user.
   * schoolId = null → super_admin: no school filter.
   */
  async activate(id: string, schoolId: string | null) {
    const user = await prisma.user.findFirst({
      where: schoolId ? { id, schoolId } : { id },
    });

    if (!user) {
      throw new UserServiceError('User not found', 404);
    }

    if (user.isActive) {
      throw new UserServiceError('User is already active', 400);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        fcmToken: true,
        phone: true,
        address: true,
        nationalId: true,
        preferredLanguage: true,
        createdAt: true,
      },
    });

    return updated;
  },

  /**
   * Deactivate a user and revoke access by deleting all refresh tokens.
   * schoolId = null → super_admin: no school filter.
   */
  async deactivate(id: string, schoolId: string | null) {
    const user = await prisma.user.findFirst({
      where: schoolId ? { id, schoolId } : { id },
    });

    if (!user) {
      throw new UserServiceError('User not found', 404);
    }

    if (!user.isActive) {
      throw new UserServiceError('User is already deactivated', 400);
    }

    // Deactivate user and revoke all refresh tokens in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          schoolId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          fcmToken: true,
          phone: true,
          address: true,
          nationalId: true,
          preferredLanguage: true,
          createdAt: true,
        },
      });

      // Revoke all refresh tokens for immediate access revocation
      await tx.refreshToken.deleteMany({
        where: { userId: id },
      });

      return updatedUser;
    });

    return updated;
  },

  /**
   * An admin gives a user a new temporary password, shown once to the admin:
   * the user must choose their own at next login, their sessions and earlier
   * reset links stop working. Not for one's own account (use change-password).
   */
  async resetPassword(id: string, actor: ResetActor): Promise<{ temporaryPassword: string }> {
    await this.findResettable(id, actor);
    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } }),
      prisma.refreshToken.deleteMany({ where: { userId: id } }),
      prisma.passwordResetToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } }),
    ]);

    return { temporaryPassword: password };
  },

  /** An admin emails a user a reset link instead: the admin never sees the password. */
  async sendResetLink(id: string, actor: ResetActor): Promise<{ email: string }> {
    const user = await this.findResettable(id, actor);
    const sent = await authService.sendPasswordResetLink(user);
    if (!sent) throw new UserServiceError('The reset email could not be sent', 502);
    return { email: user.email };
  },

  async findResettable(id: string, actor: ResetActor) {
    if (id === actor.userId) {
      throw new UserServiceError('Use "change password" for your own account', 400);
    }
    const user = await prisma.user.findFirst({
      where: actor.schoolId ? { id, schoolId: actor.schoolId } : { id },
    });
    if (!user) throw new UserServiceError('User not found', 404);
    return user;
  },

  /**
   * Create a user directly in a school (no invitation token required), with a
   * temporary password of their own, returned once (`temporaryPassword`).
   * Used by super_admin (any school) and admin (their own school).
   */
  async createDirectly(schoolId: string, input: CreateUserDirectlyInput, db: DbClient = prisma) {
    // Scoped to this school — the same email can already exist in a different school.
    const existing = await db.user.findFirst({ where: { email: input.email, schoolId } });
    if (existing) {
      throw new UserServiceError('A user with this email already exists', 409);
    }

    const deletedUser = await findRestorableUser(input.email, schoolId);
    if (deletedUser) {
      throw new UserServiceError(
        'A previously removed user with this email exists in this school',
        409,
        { restorable: true, deletedUserId: deletedUser.id },
      );
    }

    // Each account its own first password, told once to whoever creates it.
    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await db.user.create({
      data: {
        schoolId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        role: input.role as UserRole,
        preferredLanguage: (input.preferredLanguage ?? 'fr') as Language,
        isActive: true,
        mustChangePassword: true,
        phone: input.phone,
        address: input.address,
        nationalId: input.nationalId,
      },
      select: {
        id: true, schoolId: true, firstName: true, lastName: true,
        email: true, role: true, isActive: true, preferredLanguage: true, createdAt: true,
        phone: true, address: true, nationalId: true,
      },
    });

    return { ...user, temporaryPassword: password };
  },

  /**
   * Update a user's editable profile fields (admin only).
   */
  async update(id: string, schoolId: string | null, input: { firstName?: string; lastName?: string; role?: UserRole; preferredLanguage?: Language; phone?: string; address?: string; nationalId?: string }) {
    const user = await prisma.user.findFirst({ where: schoolId ? { id, schoolId } : { id } });

    if (!user) {
      throw new UserServiceError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.preferredLanguage !== undefined && { preferredLanguage: input.preferredLanguage }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.nationalId !== undefined && { nationalId: input.nationalId }),
      },
      select: {
        id: true, schoolId: true, firstName: true, lastName: true,
        email: true, role: true, isActive: true, fcmToken: true,
        phone: true, address: true, nationalId: true,
        preferredLanguage: true, createdAt: true,
      },
    });

    return updated;
  },

  /**
   * Update a user's FCM token.
   */
  async updateFcmToken(id: string, fcmToken: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new UserServiceError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { fcmToken },
      select: {
        id: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        fcmToken: true,
        preferredLanguage: true,
        createdAt: true,
      },
    });

    return updated;
  },

  /**
   * Update a user's preferred language.
   */
  async updateLanguage(id: string, preferredLanguage: Language) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new UserServiceError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { preferredLanguage },
      select: {
        id: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        fcmToken: true,
        preferredLanguage: true,
        createdAt: true,
      },
    });

    return updated;
  },
};
