import bcrypt from 'bcrypt';
import { schoolIsOpen, trialIsOver } from '../../lib/demo';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { emailService } from '../../services/email.service';
import { isEmailIdentifier } from '../../lib/phone';
import { accountIdsWithPhone } from '../../lib/phone-accounts';
import { cutSessions, keepToken } from '../../lib/session-cutoff';
import { getFrontendUrl } from '../../lib/frontend-url';
import type {
  TokenPayload,
  LoginResponse,
  LoginChoiceRequired,
  RefreshResponse,
  UserInfo,
} from './auth.types';
import { linkedAccountIds } from '../../lib/linked-accounts';
import { tenantStorage } from '../../middleware/tenancy.middleware';
import type {
  LoginInput,
  RefreshInput,
  LogoutInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
} from './auth.schema';

const ACCESS_TOKEN_EXPIRY = '15m';
/**
 * A session lasts this long after its last use online: each refresh issues a
 * new refresh token (at most once per REFRESH_TOKEN_RENEW_AFTER_HOURS), so
 * someone who uses the app stays signed in — and can open it offline.
 */
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_TOKEN_RENEW_AFTER_HOURS = 24;
/** The replaced token keeps working briefly, for requests already in flight. */
const REPLACED_REFRESH_TOKEN_GRACE_MS = 2 * 60 * 1000;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const BCRYPT_SALT_ROUNDS = 10;
/** The last-activity date is saved at most this often (one write a day). */
const ACTIVITY_RESOLUTION_MS = 24 * 60 * 60 * 1000;

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

/** Sessions too: the database keeps a hash of each refresh token, never the token. */
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compared against when no account has the login, so that a wrong login takes
 * as long as a wrong password: the answer's timing says nothing either.
 */
let noAccountHash: Promise<string> | undefined;
function decoyHash(): Promise<string> {
  return (noAccountHash ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), BCRYPT_SALT_ROUNDS));
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

/**
 * Remembers that the user used the app (shown to the platform admin, per
 * school). Never blocks or fails a sign-in.
 */
async function recordActivity(user: { id: string; lastActiveAt?: Date | null }): Promise<void> {
  if (user.lastActiveAt && Date.now() - user.lastActiveAt.getTime() < ACTIVITY_RESOLUTION_MS) return;
  try {
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  } catch (err) {
    console.error('[Auth] Failed to record activity:', err);
  }
}

function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getAccessSecret()) as TokenPayload;
}

function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getRefreshSecret()) as TokenPayload;
}

/**
 * The accounts one signs in to with this email (whatever its case: "Fatima@…"
 * is "fatima@…") or phone number (however it is written, see normalizePhone).
 */
async function findAccounts(identifier: string) {
  const value = identifier.trim();
  // Employees without access to the app (role staff) never sign in.
  if (isEmailIdentifier(value)) {
    return prisma.user.findMany({ where: { email: { equals: value, mode: 'insensitive' }, deletedAt: null, role: { not: 'staff' } } });
  }
  const ids = await accountIdsWithPhone(value);
  if (ids.length === 0) return [];
  return prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null, role: { not: 'staff' } } });
}

/**
 * The person's other accounts with the password this account had: the very
 * same one (taken from it when the account was added — the person just
 * proved they know it), or the current password they typed again.
 */
async function sameOldPassword(
  user: { id: string; email: string | null; phone: string | null; passwordHash: string },
  currentPassword: string | undefined,
): Promise<string[]> {
  const ids = await linkedAccountIds(user);
  if (ids.length === 0) return [];
  const accounts = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, passwordHash: true } });
  const checks = await Promise.all(
    accounts.map(async (a) =>
      a.passwordHash === user.passwordHash || (currentPassword !== undefined && (await bcrypt.compare(currentPassword, a.passwordHash)))
        ? a.id
        : null,
    ),
  );
  return checks.filter((id): id is string => id !== null);
}

export const authService = {
  async login(input: LoginInput): Promise<LoginResponse | LoginChoiceRequired> {
    const candidates = await findAccounts(input.email);

    if (candidates.length === 0) {
      await bcrypt.compare(input.password, await decoyHash());
      throw new AuthError('Invalid email or password', 401);
    }

    const passwordChecks = await Promise.all(
      candidates.map(async (candidate) => ({
        user: candidate,
        valid: await bcrypt.compare(input.password, candidate.passwordHash),
      })),
    );
    let matches = passwordChecks.filter((c) => c.valid).map((c) => c.user);

    if (matches.length === 0) {
      throw new AuthError('Invalid email or password', 401);
    }

    // The school picked after a choiceRequired answer.
    if (matches.length > 1 && input.schoolId !== undefined) {
      const picked = matches.filter((m) => (m.schoolId ?? '') === input.schoolId);
      if (picked.length > 0) matches = picked;
    }

    // Two accounts of one school share this phone number and password: no
    // school to choose between, the email (or another number) must say which.
    if (matches.length > 1 && new Set(matches.map((m) => m.schoolId)).size < matches.length) {
      throw new AuthError('Several accounts use this phone number', 409);
    }

    if (matches.length > 1) {
      const schools = await Promise.all(
        matches.map(async (candidate) => {
          if (!candidate.schoolId) return { schoolId: null, schoolName: null, role: candidate.role };
          const school = await prisma.school.findUnique({ where: { id: candidate.schoolId } });
          return { schoolId: candidate.schoolId, schoolName: school?.name ?? null, role: candidate.role };
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
      if (school && !schoolIsOpen(school)) {
        // A trial over: the director is told so, to subscribe (its data is kept).
        if (school.isActive && trialIsOver(school)) throw new AuthError('The trial period of this school has ended', 403);
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
    keepToken(user.id, accessToken);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashRefreshToken(refreshToken),
        expiresAt,
      },
    });
    void recordActivity(user);

    const userInfo: UserInfo = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      schoolId: user.schoolId,
      mustChangePassword: user.mustChangePassword,
      ...(user.mustChangePassword && (await linkedAccountIds(user)).length > 0 && { hasOtherAccounts: true }),
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
      where: { token: hashRefreshToken(input.refreshToken) },
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
      if (school && !schoolIsOpen(school)) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new AuthError('Invalid or expired refresh token', 401);
      }
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      schoolId: user.schoolId,
      branchId: payload.branchId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    const newAccessToken = generateAccessToken(tokenPayload);
    keepToken(user.id, newAccessToken);
    void recordActivity(user);

    // Extend the session: a new refresh token, valid REFRESH_TOKEN_EXPIRY_DAYS
    // from now. The old one stops working after a short grace period.
    const renewAfter = new Date(Date.now() - REFRESH_TOKEN_RENEW_AFTER_HOURS * 60 * 60 * 1000);
    if (storedToken.createdAt > renewAfter) {
      return { accessToken: newAccessToken };
    }
    const newRefreshToken = generateRefreshToken(tokenPayload);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    const graceEnd = new Date(Date.now() + REPLACED_REFRESH_TOKEN_GRACE_MS);
    await prisma.$transaction([
      prisma.refreshToken.create({ data: { userId: user.id, token: hashRefreshToken(newRefreshToken), expiresAt } }),
      prisma.refreshToken.updateMany({
        where: { id: storedToken.id, expiresAt: { gt: graceEnd } },
        data: { expiresAt: graceEnd },
      }),
    ]);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(input: LogoutInput): Promise<void> {
    // The access token of the session being left stops working too.
    try {
      cutSessions(verifyRefreshToken(input.refreshToken).userId);
    } catch {
      // Not a token of ours (or expired): nothing to cut.
    }
    // Delete the refresh token from database to invalidate it
    await prisma.refreshToken.deleteMany({
      where: { token: hashRefreshToken(input.refreshToken) },
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
   * Emails a reset link (Arabic and French) for the accounts using this email
   * (case-insensitive): one link, since a person has one password for all
   * their accounts (see confirmPasswordReset). The link is single-use and
   * expires after PASSWORD_RESET_EXPIRY_HOURS; only a hash of it is stored.
   * Returns how many accounts it covers.
   */
  async sendPasswordResetLinks(email: string): Promise<number> {
    const users = await prisma.user.findMany({
      where: { email: { equals: email.trim(), mode: 'insensitive' }, role: { not: 'staff' } },
      orderBy: [{ lastActiveAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    const user = users[0];
    if (!user?.email) return 0;
    await authService.sendPasswordResetLink({ ...user, email: user.email }, users.length);
    return users.length;
  },

  /**
   * Emails one account a new reset link; its earlier links stop working.
   * The token is saved either way: a failed email only means asking again.
   * Returns whether the email went out.
   */
  async sendPasswordResetLink(
    user: { id: string; email: string; firstName: string },
    /** How many accounts the person has (the new password is for all of them). */
    accounts = 1,
  ): Promise<boolean> {
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

    try {
      await emailService.sendPasswordResetEmail(user.email, {
        firstName: user.firstName,
        resetUrl: `${getFrontendUrl()}/reset-password/confirm?token=${token}`,
        expiresInHours: PASSWORD_RESET_EXPIRY_HOURS,
        accounts,
      });
      return true;
    } catch (err) {
      console.error('[AuthService] Failed to send password reset email:', err);
      return false;
    }
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

    // The link went to the person's mailbox: proof enough for all their
    // accounts with that email (other schools, the platform) — one password.
    const userIds = [
      resetToken.userId,
      ...(resetToken.user.email ? await linkedAccountIds({ id: resetToken.userId, email: resetToken.user.email, phone: null }) : []),
    ];

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { id: { in: userIds } },
        // The user chose this password: no need to change it again at login
        // (e.g. an invited user who forgot the temporary one).
        data: { passwordHash, mustChangePassword: false },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all refresh tokens for these accounts (force re-login)
      prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      }),
      // And their devices stop getting the notifications until they sign in again
      prisma.pushDevice.deleteMany({ where: { userId: { in: userIds } } }),
    ]);
    for (const id of userIds) cutSessions(id);
  },

  async changePassword(userId: string, newPassword: string, currentPassword?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError('User not found', 404);

    // An open session is not enough to take the account: the current password
    // is asked for, except when the account is on a temporary one it has to
    // replace (the person has just signed in with it).
    if (!user.mustChangePassword) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new AuthError('Current password is incorrect', 400);
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    // The person's other accounts (other schools, the platform) that had the
    // same password follow: one password for all. Only those — a temporary
    // password one school gave after a reset opens nothing else (the person
    // gets them back together by choosing their usual password, or by a
    // forgotten-password link).
    // Outside this session's school: the other accounts are in other schools.
    const others = await tenantStorage.exit(() => sameOldPassword(user, user.mustChangePassword ? undefined : currentPassword));
    if (others.length > 0) {
      await tenantStorage.exit(() =>
        prisma.$transaction([
          prisma.user.updateMany({ where: { id: { in: others } }, data: { passwordHash, mustChangePassword: false } }),
          prisma.refreshToken.deleteMany({ where: { userId: { in: others } } }),
        ]),
      );
      for (const id of others) cutSessions(id);
    }

    // Fresh tokens with mustChangePassword cleared, so the current session
    // isn't immediately blocked by the mustChangePassword gate.
    const tokenPayload: TokenPayload = {
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      mustChangePassword: false,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Every other device signs in again with the new password; this one goes
    // on with its own new session (without it, it would end with the access
    // token, 15 minutes later).
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.refreshToken.create({ data: { userId, token: hashRefreshToken(refreshToken), expiresAt } }),
    ]);
    cutSessions(userId, accessToken);

    return { accessToken, refreshToken };
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
