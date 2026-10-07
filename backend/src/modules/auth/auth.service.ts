import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { emailService } from '../../services/email.service';
import type {
  TokenPayload,
  LoginResponse,
  LoginChoiceRequired,
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

/** Reset links are stored hashed: a leaked database holds no usable link. */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: TokenPayload): string {
  const expiresIn = `${REFRESH_TOKEN_EXPIRY_DAYS}d`;
  // A random jti makes every token unique. Without it, two logins (or
  // refreshes) of the same user within the same second signed identical
  // tokens, and storing the second hit the unique constraint (a 500).
  return jwt.sign(payload, getRefreshSecret(), { expiresIn, jwtid: crypto.randomUUID() });
}

function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getAccessSecret()) as TokenPayload;
}

function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getRefreshSecret()) as TokenPayload;
}

export const authService = {
  async login(input: LoginInput): Promise<LoginResponse | LoginChoiceRequired> {
    // Emails match regardless of case: an account saved as "Fatima@…" signs in with "fatima@…".
    const candidates = await prisma.user.findMany({
      where: { email: { equals: input.email.trim(), mode: 'insensitive' }, deletedAt: null },
    });

    if (candidates.length === 0) {
      throw new AuthError('Invalid email or password', 401);
    }

    const passwordChecks = await Promise.all(
      candidates.map(async (candidate) => ({
        user: candidate,
        valid: await bcrypt.compare(input.password, candidate.passwordHash),
      })),
    );
    const matches = passwordChecks.filter((c) => c.valid).map((c) => c.user);

    if (matches.length === 0) {
      throw new AuthError('Invalid email or password', 401);
    }

    if (matches.length > 1) {
      const schools = await Promise.all(
        matches.map(async (candidate) => {
          if (!candidate.schoolId) return { schoolId: null, schoolName: null };
          const school = await prisma.school.findUnique({ where: { id: candidate.schoolId } });
          return { schoolId: candidate.schoolId, schoolName: school?.name ?? null };
        }),
      );
      return { choiceRequired: true, schools };
    }

    const user = matches[0];

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

    const tokenPayload: TokenPayload = {
      userId: user.id,
      schoolId: user.schoolId,
      branchId: user.branchId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
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

    // Re-fetch the user so a demotion/deactivation is picked up immediately,
    // instead of trusting the (potentially stale) role/schoolId baked into the refresh token.
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    if (user.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
      if (school && !school.isActive) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new AuthError('Invalid or expired refresh token', 401);
      }
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      schoolId: user.schoolId,
      branchId: payload.branchId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    return { accessToken: newAccessToken };
  },

  async logout(input: LogoutInput): Promise<void> {
    // Delete the refresh token from database to invalidate it
    await prisma.refreshToken.deleteMany({
      where: { token: input.refreshToken },
    });
  },

  /**
   * Starts a password reset. Always answers the same way, at once: whether
   * an account exists isn't revealed, not even by how long it takes — the
   * links are sent in the background.
   */
  requestPasswordReset(input: PasswordResetRequestInput): Promise<void> {
    void authService.sendPasswordResetLinks(input.email).catch((err) => {
      console.error('[AuthService] Failed to send password reset links:', err);
    });
    return Promise.resolve();
  },

  /**
   * Emails a reset link to every account using this email (case-insensitive),
   * one per school when the email has accounts in several. Each link is
   * single-use and expires after PASSWORD_RESET_EXPIRY_HOURS; only a hash of
   * it is stored. Returns how many links were sent.
   */
  async sendPasswordResetLinks(email: string): Promise<number> {
    const users = await prisma.user.findMany({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      include: { school: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    for (const user of users) {
      // Earlier links for this account stop working.
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token: hashResetToken(token), expiresAt },
      });

      // The token is saved either way: a failed email only means asking again.
      try {
        await emailService.sendPasswordResetEmail(user.email, {
          firstName: user.firstName,
          resetUrl: `${getFrontendUrl()}/reset-password/confirm?token=${token}`,
          language: user.preferredLanguage,
          expiresInHours: PASSWORD_RESET_EXPIRY_HOURS,
          // Tells the accounts apart when the email has several.
          schoolName: users.length > 1 ? (user.school?.name ?? null) : null,
        });
      } catch (err) {
        console.error('[AuthService] Failed to send password reset email:', err);
      }
    }
    return users.length;
  },

  async confirmPasswordReset(input: PasswordResetConfirmInput): Promise<void> {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashResetToken(input.token) },
      include: { user: true },
    });

    // Codes let the page explain what happened and offer a new link.
    if (!resetToken) {
      throw new AuthError('Invalid or expired reset token', 400, 'RESET_LINK_INVALID');
    }

    if (resetToken.usedAt) {
      throw new AuthError('Reset token has already been used', 400, 'RESET_LINK_USED');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new AuthError('Reset token has expired', 400, 'RESET_LINK_EXPIRED');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        // The user chose this password: no need to change it again at login
        // (e.g. an invited user who forgot the temporary one).
        data: { passwordHash, mustChangePassword: false },
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

  async changePassword(userId: string, newPassword: string): Promise<{ accessToken: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('User not found', 404);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    // Invalidate all existing refresh tokens so the user re-authenticates with new password
    await prisma.refreshToken.deleteMany({ where: { userId } });

    // Issue a fresh access token with mustChangePassword cleared so the current
    // session isn't immediately blocked by the mustChangePassword gate below.
    const accessToken = generateAccessToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      mustChangePassword: false,
    });

    return { accessToken };
  },

  verifyAccessToken,
};

export class AuthError extends Error {
  statusCode: number;
  /** API error code (the client maps it to a message). */
  code: string;

  constructor(message: string, statusCode: number, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
