import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => {
  const db = {
    classroom: { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), findMany: vi.fn(async () => []) },
    substitution: { findFirst: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn(async () => null) },
    parentChildLink: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return { default: db };
});
vi.mock('../../services/notification.service', () => ({
  notificationService: { notify: vi.fn(), notifyMany: vi.fn() },
}));
vi.mock('../users/users.service', () => ({ usersService: { createDirectly: vi.fn(async () => ({ id: 'new-t' })) } }));
vi.mock('../admin/dashboard.service', () => ({ schoolToday: () => '2026-10-12' }));

import prisma from '../../lib/prisma';
import { substitutionsService } from './substitutions.service';
import { teachesClassroom } from './teaching-access';

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, Fn>>;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const year = { startDate: day('2026-09-01'), endDate: day('2027-06-30') };
const classroom = { id: 'c1', schoolId: 's1', teacherUserId: 'titular', academicYear: year };
const input = {
  classroomId: 'c1',
  substituteUserId: 'sub',
  startDate: '2026-10-12',
  endDate: '2026-10-12',
  reason: 'illness' as const,
  notifyParents: false,
  allowBusySubstitute: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.classroom.findFirst.mockResolvedValue(classroom);
  db.substitution.findFirst.mockResolvedValue(null);
  db.user.findFirst.mockResolvedValue({ id: 'sub' });
  db.substitution.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'r1', ...data, classroom: { name: 'Papillons' } }));
});

describe('create', () => {
  it("records a day's replacement, the class's teacher as the absent one", async () => {
    const { substitution } = await substitutionsService.create('s1', 'admin', input);
    expect(substitution).toMatchObject({ classroomId: 'c1', absentTeacherId: 'titular', substituteUserId: 'sub' });
  });

  it('refuses a second replacement of the class on the same days', async () => {
    db.substitution.findFirst.mockResolvedValueOnce({ id: 'other' });
    await expect(substitutionsService.create('s1', 'admin', input)).rejects.toMatchObject({ statusCode: 409, code: 'CLASS_ALREADY_REPLACED' });
  });

  it('asks before giving a busy substitute a second class', async () => {
    db.substitution.findFirst
      .mockResolvedValueOnce(null) // the class is free
      .mockResolvedValueOnce({ id: 'x', classroom: { name: 'Poussins' } }); // the substitute isn't
    await expect(substitutionsService.create('s1', 'admin', input)).rejects.toMatchObject({ code: 'SUBSTITUTE_BUSY' });
    db.substitution.findFirst.mockResolvedValue(null);
    await expect(substitutionsService.create('s1', 'admin', { ...input, allowBusySubstitute: true })).resolves.toBeTruthy();
  });

  it("refuses the class's own teacher, and dates outside the school year", async () => {
    await expect(substitutionsService.create('s1', 'admin', { ...input, substituteUserId: 'titular' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(substitutionsService.create('s1', 'admin', { ...input, endDate: '2027-07-15' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('makes a teacher account for a substitute from outside', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'new-t' });
    const { substitution, newSubstitute } = await substitutionsService.create('s1', 'admin', {
      ...input,
      substituteUserId: null,
      newSubstitute: { firstName: 'Nadia', lastName: 'Vacataire', email: 'n@v.dz' },
    });
    expect(newSubstitute).toBe(true);
    expect(substitution).toMatchObject({ substituteUserId: 'new-t' });
  });
});

describe('endToday', () => {
  it('ends a running replacement today, cancels one not started yet', async () => {
    db.substitution.findFirst.mockResolvedValue({ id: 'r1', schoolId: 's1', startDate: day('2026-10-05'), endDate: day('2026-10-30'), cancelledAt: null });
    await substitutionsService.endToday('r1', 's1');
    expect(db.substitution.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { endDate: day('2026-10-12') } }));
    db.substitution.findFirst.mockResolvedValue({ id: 'r1', schoolId: 's1', startDate: day('2026-10-20'), endDate: day('2026-10-30'), cancelledAt: null });
    await substitutionsService.endToday('r1', 's1');
    expect(db.substitution.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { cancelledAt: expect.any(Date) } }));
  });
});

describe('teachesClassroom', () => {
  it("lets the substitute in on the replacement's days only", async () => {
    expect(await teachesClassroom('titular', { id: 'c1', teacherUserId: 'titular' })).toBe(true);
    db.substitution.findFirst.mockResolvedValueOnce({ id: 'r1' });
    expect(await teachesClassroom('sub', { id: 'c1', teacherUserId: 'titular' }, '2026-10-12')).toBe(true);
    expect(db.substitution.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ substituteUserId: 'sub', startDate: { lte: day('2026-10-12') }, endDate: { gte: day('2026-10-12') } }),
    }));
    db.substitution.findFirst.mockResolvedValueOnce(null);
    expect(await teachesClassroom('sub', { id: 'c1', teacherUserId: 'titular' }, '2026-11-02')).toBe(false);
  });
});
