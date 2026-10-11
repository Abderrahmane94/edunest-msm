import type { Prisma } from '@prisma/client';
import prisma, { type DbClient } from '../../lib/prisma';
import { asDay } from '../substitutions/teaching-access';
import {
  FULL_PERMISSIONS,
  OFFICE_DEFAULT_PERMISSIONS,
  normalizePermissions,
  AREAS,
  type Area,
  type Level,
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

/** What an exception can change: an area, or one of the two separate rights. */
export const EXCEPTION_KEYS = [...AREAS, 'delete', 'correctPayments'] as const;
export type ExceptionKey = (typeof EXCEPTION_KEYS)[number];

/** Who acts (the director): kept by name in the journal. */
export interface Actor {
  userId: string;
  schoolId: string;
}

type Change = { key: string; from: string; to: string };

/** What differs between two sets of rights, key by key ("children", "delete"…). */
function diffPermissions(a: Permissions, b: Permissions): Change[] {
  const changes: Change[] = [];
  for (const area of AREAS) {
    if (a.areas[area] !== b.areas[area]) changes.push({ key: area, from: a.areas[area], to: b.areas[area] });
  }
  for (const key of ['delete', 'correctPayments'] as const) {
    if (a[key] !== b[key]) changes.push({ key, from: a[key] ? 'edit' : 'none', to: b[key] ? 'edit' : 'none' });
  }
  return changes;
}

/** Rights with exceptions applied over them. */
export function withExceptions(p: Permissions, exceptions: { area: string; level: string }[]): Permissions {
  const out: Permissions = { areas: { ...p.areas }, delete: p.delete, correctPayments: p.correctPayments };
  for (const e of exceptions) {
    if (e.area === 'delete' || e.area === 'correctPayments') out[e.area] = e.level === 'edit';
    else if ((AREAS as readonly string[]).includes(e.area) && ['none', 'view', 'edit'].includes(e.level)) {
      out.areas[e.area as Area] = e.level as Level;
    }
  }
  return out;
}

/** Exceptions still in force today (no end, or ending today or later). */
const activeExceptions = () => ({ OR: [{ endsOn: null }, { endsOn: { gte: asDay() } }] });

class AccessService {
  /**
   * A user's rights: everything for the director (and super_admin); for the
   * office staff, their profile (the school's default one when they have none)
   * with their exceptions in force over it; nothing for others, who keep their
   * own rules (teachers, parents).
   */
  async permissionsOf(user: { userId: string; role: string; schoolId?: string | null }): Promise<Permissions> {
    if (user.role === 'admin' || user.role === 'super_admin') return FULL_PERMISSIONS;
    if (user.role !== 'administrative') return NONE;
    const row = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        accessProfile: { select: { permissions: true } },
        accessExceptions: { where: activeExceptions(), select: { area: true, level: true } },
      },
    });
    let base: Permissions;
    if (row?.accessProfile) base = normalizePermissions(row.accessProfile.permissions);
    else {
      const fallback = user.schoolId
        ? await prisma.accessProfile.findFirst({ where: { schoolId: user.schoolId, isDefault: true }, select: { permissions: true } })
        : null;
      base = fallback ? normalizePermissions(fallback.permissions) : OFFICE_DEFAULT_PERMISSIONS;
    }
    return withExceptions(base, row?.accessExceptions ?? []);
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

  /** The school's profiles, default first, with the office staff on each (and whether they have exceptions). */
  async list(schoolId: string) {
    await this.ensureDefault(schoolId);
    const profiles = await prisma.accessProfile.findMany({
      where: { schoolId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        users: {
          where: { deletedAt: null, role: 'administrative' },
          select: { id: true, firstName: true, lastName: true, isActive: true, _count: { select: { accessExceptions: { where: activeExceptions() } } } },
          orderBy: { firstName: 'asc' },
        },
      },
    });
    // Office staff without a profile have the default one.
    const unassigned = await prisma.user.findMany({
      where: { schoolId, deletedAt: null, role: 'administrative', accessProfileId: null },
      select: { id: true, firstName: true, lastName: true, isActive: true, _count: { select: { accessExceptions: { where: activeExceptions() } } } },
      orderBy: { firstName: 'asc' },
    });
    return profiles.map((p) => ({
      ...p,
      permissions: normalizePermissions(p.permissions),
      users: [...p.users, ...(p.isDefault ? unassigned : [])].map(({ _count, ...u }) => ({ ...u, hasExceptions: _count.accessExceptions > 0 })),
    }));
  }

  async create(actor: Actor, input: { name: string; description?: string | null; permissions: Permissions }) {
    await this.assertNameFree(actor.schoolId, input.name);
    const permissions = normalizePermissions(input.permissions);
    return prisma.$transaction(async (tx) => {
      const p = await tx.accessProfile.create({
        data: {
          schoolId: actor.schoolId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          permissions: permissions as unknown as Prisma.InputJsonValue,
        },
      });
      await this.log(tx, actor, 'profile_created', { profileId: p.id, profileName: p.name, details: { changes: diffPermissions(NONE, permissions) } });
      return { ...p, permissions };
    });
  }

  async update(
    actor: Actor,
    id: string,
    input: { name?: string; description?: string | null; permissions?: Permissions; isDefault?: boolean },
  ) {
    const current = await this.find(id, actor.schoolId);
    if (input.name !== undefined) await this.assertNameFree(actor.schoolId, input.name, id);
    if (input.isDefault === false && current.isDefault) {
      throw new AccessServiceError('Choose another default profile instead', 400);
    }
    const before = normalizePermissions(current.permissions);
    return prisma.$transaction(async (tx) => {
      // One default profile per school.
      if (input.isDefault) {
        await tx.accessProfile.updateMany({ where: { schoolId: actor.schoolId, id: { not: id } }, data: { isDefault: false } });
      }
      const p = await tx.accessProfile.update({
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
      const after = normalizePermissions(p.permissions);
      const changes = diffPermissions(before, after);
      if (input.name !== undefined && input.name.trim() !== current.name) changes.unshift({ key: 'name', from: current.name, to: p.name });
      if (changes.length) await this.log(tx, actor, 'profile_updated', { profileId: id, profileName: p.name, details: { changes } });
      if (input.isDefault && !current.isDefault) await this.log(tx, actor, 'profile_default', { profileId: id, profileName: p.name });
      return { ...p, permissions: after };
    });
  }

  /** A profile is deleted; its staff get the school's default profile. */
  async delete(actor: Actor, id: string) {
    const current = await this.find(id, actor.schoolId);
    if (current.isDefault) throw new AccessServiceError('The default profile cannot be deleted', 400);
    const fallback = await this.ensureDefault(actor.schoolId);
    await prisma.$transaction(async (tx) => {
      const moved = await tx.user.findMany({ where: { accessProfileId: id }, select: { firstName: true, lastName: true } });
      await tx.user.updateMany({ where: { accessProfileId: id }, data: { accessProfileId: fallback.id } });
      await tx.accessProfile.delete({ where: { id } });
      await this.log(tx, actor, 'profile_deleted', {
        profileId: id,
        profileName: current.name,
        details: { movedTo: fallback.name, people: moved.map((u) => `${u.firstName} ${u.lastName}`) },
      });
    });
  }

  /** Gives an office staff member a profile. */
  async assign(actor: Actor, userId: string, profileId: string) {
    const user = await this.officeUser(userId, actor.schoolId);
    const profile = await this.find(profileId, actor.schoolId);
    if (user.accessProfileId === profileId) return;
    const before = user.accessProfileId
      ? (await prisma.accessProfile.findFirst({ where: { id: user.accessProfileId }, select: { name: true } }))?.name
      : (await this.ensureDefault(actor.schoolId)).name;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { accessProfileId: profileId } });
      await this.log(tx, actor, 'profile_assigned', {
        profileId,
        profileName: profile.name,
        targetUserId: userId,
        targetName: `${user.firstName} ${user.lastName}`,
        details: { from: before ?? null, to: profile.name },
      });
    });
  }

  /** A person's exceptions (in force and ended), latest first. */
  async exceptionsOf(userId: string, schoolId: string) {
    await this.officeUser(userId, schoolId);
    const list = await prisma.accessException.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const today = asDay();
    return list.map((e) => ({ ...e, active: !e.endsOn || e.endsOn >= today }));
  }

  /** Sets a person's exception in one area (replacing the one there). */
  async setException(actor: Actor, userId: string, input: { area: ExceptionKey; level: Level; endsOn?: string | null; note?: string | null }) {
    const user = await this.officeUser(userId, actor.schoolId);
    const flag = input.area === 'delete' || input.area === 'correctPayments';
    if (flag && input.level === 'view') throw new AccessServiceError('This right is on or off', 400);
    const endsOn = input.endsOn ? asDay(input.endsOn) : null;
    if (endsOn && endsOn < asDay()) throw new AccessServiceError('The end date is already past', 400);
    return prisma.$transaction(async (tx) => {
      const e = await tx.accessException.upsert({
        where: { userId_area: { userId, area: input.area } },
        create: { schoolId: actor.schoolId, userId, area: input.area, level: input.level, endsOn, note: input.note || null, createdByUserId: actor.userId },
        update: { level: input.level, endsOn, note: input.note || null, createdByUserId: actor.userId, createdAt: new Date() },
      });
      await this.log(tx, actor, 'exception_added', {
        targetUserId: userId,
        targetName: `${user.firstName} ${user.lastName}`,
        details: { key: input.area, level: input.level, endsOn: input.endsOn ?? null, note: input.note || null },
      });
      return e;
    });
  }

  async removeException(actor: Actor, userId: string, exceptionId: string) {
    const user = await this.officeUser(userId, actor.schoolId);
    const e = await prisma.accessException.findFirst({ where: { id: exceptionId, userId } });
    if (!e) throw new AccessServiceError('Exception not found', 404);
    await prisma.$transaction(async (tx) => {
      await tx.accessException.delete({ where: { id: exceptionId } });
      await this.log(tx, actor, 'exception_removed', {
        targetUserId: userId,
        targetName: `${user.firstName} ${user.lastName}`,
        details: { key: e.area, level: e.level },
      });
    });
  }

  /** The journal, latest first: everything, or about one person or one profile. */
  journal(schoolId: string, filters: { userId?: string; profileId?: string } = {}) {
    return prisma.accessLog.findMany({
      where: {
        schoolId,
        ...(filters.userId ? { targetUserId: filters.userId } : {}),
        ...(filters.profileId ? { profileId: filters.profileId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  private async log(
    db: DbClient,
    actor: Actor,
    action: string,
    entry: { profileId?: string; profileName?: string; targetUserId?: string; targetName?: string; details?: Record<string, unknown> },
  ) {
    const who = await db.user.findUnique({ where: { id: actor.userId }, select: { firstName: true, lastName: true } });
    await db.accessLog.create({
      data: {
        schoolId: actor.schoolId,
        actorUserId: actor.userId,
        actorName: who ? `${who.firstName} ${who.lastName}`.trim() : '',
        action,
        profileId: entry.profileId ?? null,
        profileName: entry.profileName ?? null,
        targetUserId: entry.targetUserId ?? null,
        targetName: entry.targetName ?? null,
        details: (entry.details ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async officeUser(userId: string, schoolId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId, deletedAt: null } });
    if (!user) throw new AccessServiceError('User not found', 404);
    if (user.role !== 'administrative') {
      throw new AccessServiceError('Only office staff (administrative) have a profile', 400);
    }
    return user;
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
