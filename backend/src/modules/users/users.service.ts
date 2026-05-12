import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { emailService } from '../../services/email.service';
import type { UserRole, Language } from '@prisma/client';
import type { CreateUserDirectlyInput } from './users.schema';

const INVITATION_EXPIRY_HOURS = 48;
const BCRYPT_SALT_ROUNDS = 10;

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

export class UserServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UserServiceError';
    this.statusCode = statusCode;
  }
}

export const usersService = {
  /**
   * Send an invitation email to a user with a one-time token.
   */
  async invite(email: string, role: UserRole, schoolId: string): Promise<{ message: string }> {
    // Check if user already exists in this school
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UserServiceError('A user with this email already exists', 409);
    }

    // Get school name for the email
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new UserServiceError('School not found', 404);
    }

    // Invalidate any existing unused invitation tokens for this email
    await prisma.invitationToken.updateMany({
      where: { email, usedAt: null },
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

    // Send invitation email
    const invitationUrl = `${getFrontendUrl()}/register?token=${token}`;
    await emailService.sendInvitationEmail(email, invitationUrl, school.name, role);

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

    return {
      email: invitation.email,
      role: invitation.role,
      schoolId: invitation.schoolId,
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

    // Check if user already exists (race condition guard)
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
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
   * List users in a school with pagination.
   */
  async list(schoolId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    // Exclude super_admin users — they are platform-level and not school-scoped
    const where = { schoolId, role: { not: 'super_admin' as const } };

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
          preferredLanguage: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
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
        isActive: true,
        fcmToken: true,
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
   */
  async activate(id: string, schoolId: string) {
    const user = await prisma.user.findFirst({
      where: { id, schoolId },
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
        preferredLanguage: true,
        createdAt: true,
      },
    });

    return updated;
  },

  /**
   * Deactivate a user and revoke access by deleting all refresh tokens.
   */
  async deactivate(id: string, schoolId: string) {
    const user = await prisma.user.findFirst({
      where: { id, schoolId },
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
   * Create a user directly in a school (no invitation token required).
   * Used by super_admin (any school) and admin (their own school).
   */
  async createDirectly(schoolId: string, input: CreateUserDirectlyInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new UserServiceError('A user with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        schoolId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        role: input.role as UserRole,
        preferredLanguage: (input.preferredLanguage ?? 'fr') as Language,
        isActive: true,
      },
      select: {
        id: true, schoolId: true, firstName: true, lastName: true,
        email: true, role: true, isActive: true, preferredLanguage: true, createdAt: true,
      },
    });

    return user;
  },

  /**
   * Update a user's editable profile fields (admin only).
   */
  async update(id: string, schoolId: string | null, input: { firstName?: string; lastName?: string; role?: UserRole; preferredLanguage?: Language }) {
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
      },
      select: {
        id: true, schoolId: true, firstName: true, lastName: true,
        email: true, role: true, isActive: true, fcmToken: true,
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
