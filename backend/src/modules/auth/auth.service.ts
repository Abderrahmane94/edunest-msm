import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { emailService } from '../../services/email.service';
import type {
  TokenPayload,
  LoginResponse,
  RefreshResponse,
  UserInfo,
} from './auth.types';
import type {
  LoginInput,
  RefreshInput,
  LogoutInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
} from './auth.schema';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const BCRYPT_SALT_ROUNDS = 10;

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return secret;
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: TokenPayload): string {
  const expiresIn = `${REFRESH_TOKEN_EXPIRY_DAYS}d`;
  return jwt.sign(payload, getRefreshSecret(), { expiresIn });
}

function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getAccessSecret()) as TokenPayload;
}

function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getRefreshSecret()) as TokenPayload;
}

export const authService = {
  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AuthError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AuthError('Account is deactivated', 403);
    }

    // Block login if the user's school is inactive
    if (user.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
      if (school && !school.isActive) {
        throw new AuthError('School account is inactive', 403);
      }
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password', 401);
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      schoolId: user.schoolId,
      branchId: user.branchId,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    const userInfo: UserInfo = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      schoolId: user.schoolId,
      mustChangePassword: user.mustChangePassword,
    };

    return { accessToken, refreshToken, user: userInfo };
  },

  async refresh(input: RefreshInput): Promise<RefreshResponse> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(input.refreshToken);
    } catch {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: input.refreshToken },
    });

    if (!storedToken) {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    if (storedToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      schoolId: payload.schoolId,
      branchId: payload.branchId,
      role: payload.role,
    });

    return { accessToken: newAccessToken };
  },

  async logout(input: LogoutInput): Promise<void> {
    // Delete the refresh token from database to invalidate it
    await prisma.refreshToken.deleteMany({
      where: { token: input.refreshToken },
    });
  },

  async requestPasswordReset(input: PasswordResetRequestInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Always return success to prevent email enumeration
    if (!user) return;

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a secure one-time token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send password reset email
    const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;
    await emailService.sendPasswordResetEmail(user.email, user.firstName, resetUrl);
  },

  async confirmPasswordReset(input: PasswordResetConfirmInput): Promise<void> {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: input.token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new AuthError('Invalid or expired reset token', 400);
    }

    if (resetToken.usedAt) {
      throw new AuthError('Reset token has already been used', 400);
    }

    if (resetToken.expiresAt < new Date()) {
      throw new AuthError('Reset token has expired', 400);
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all refresh tokens for this user (force re-login)
      prisma.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);
  },

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('User not found', 404);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    // Invalidate all existing refresh tokens so the user re-authenticates with new password
    await prisma.refreshToken.deleteMany({ where: { userId } });
  },

  verifyAccessToken,
};

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
