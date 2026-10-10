import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every query the registration makes goes through the transaction client `tx`.
const tx = {
  academicYear: { findFirst: vi.fn() },
  child: { create: vi.fn(), findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  parentChildLink: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  emergencyContact: { create: vi.fn() },
  medicalNote: { create: vi.fn() },
  classroom: { findFirst: vi.fn() },
  classroomEnrollment: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  branch: { findFirst: vi.fn() },
};

vi.mock('../../lib/prisma', () => ({
  default: {
    $transaction: vi.fn((fn: (client: unknown) => unknown) => fn(tx)),
    child: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('../../services/soft-delete.service', () => ({ softDeleteService: { softDelete: vi.fn() } }));
vi.mock('../../services/cloudinary.service', () => ({ cloudinaryService: {} }));
vi.mock('../users/users.service', () => ({
  usersService: { createDirectly: vi.fn() },
  UserServiceError: class extends Error {},
}));
vi.mock('../payments/enrollment.service', () => ({
  enrollmentService: { createInTransaction: vi.fn() },
  EnrollmentServiceError: class extends Error {},
}));

import prisma from '../../lib/prisma';
import { childrenService, ChildServiceError } from './children.service';
import { usersService } from '../users/users.service';
import { enrollmentService } from '../payments/enrollment.service';

const schoolId = 'school-1';
const yearId = '11111111-1111-4111-8111-111111111111';
const child = { id: 'child-1', schoolId, firstName: 'Lina', lastName: 'Saidi', enrollments: [] };

const baseInput = {
  child: {
    firstName: 'Lina',
    lastName: 'Saidi',
    dateOfBirth: '2022-03-01',
    gender: 'female' as const,
    enrollmentDate: '2026-09-15',
    academicYearId: yearId,
  },
  emergencyContacts: [],
  medicalNotes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.academicYear.findFirst.mockResolvedValue({ id: yearId, schoolId });
  tx.child.create.mockResolvedValue(child);
  tx.child.findFirst.mockResolvedValue(child);
  tx.user.findFirst.mockResolvedValue({ id: 'parent-1', role: 'parent' });
  tx.parentChildLink.count.mockResolvedValue(0);
  tx.parentChildLink.findUnique.mockResolvedValue(null);
  tx.parentChildLink.create.mockResolvedValue({ id: 'link-1' });
  tx.emergencyContact.create.mockResolvedValue({ id: 'contact-1' });
  tx.medicalNote.create.mockResolvedValue({ id: 'note-1' });
  tx.classroom.findFirst.mockResolvedValue({ id: 'class-1', name: 'Petits', capacity: 20, academicYearId: yearId });
  tx.classroomEnrollment.findFirst.mockResolvedValue(null);
  tx.classroomEnrollment.count.mockResolvedValue(3);
  tx.classroomEnrollment.create.mockResolvedValue({ id: 'ce-1' });
  tx.branch.findFirst.mockResolvedValue({ id: 'branch-1', schoolId });
});

describe('childrenService.register', () => {
  it('creates the child and everything around it inside one transaction', async () => {
    vi.mocked(usersService.createDirectly).mockResolvedValue({ id: 'new-parent' } as never);
    vi.mocked(enrollmentService.createInTransaction).mockResolvedValue({ enrollmentId: 'enr-1' } as never);

    const result = await childrenService.register(schoolId, {
      ...baseInput,
      parent: {
        relationship: 'mother',
        newParent: { firstName: 'Sara', lastName: 'Saidi', email: 'sara@example.dz' },
      },
      emergencyContacts: [
        { name: 'Omar', relationship: 'uncle', phone: '0555 12 34 56', isAuthorizedPickup: true },
        { name: 'Nadia', relationship: 'aunt', phone: '0555 65 43 21', isAuthorizedPickup: false },
      ],
      medicalNotes: [{ type: 'allergy', title: 'Arachides', severity: 'high' }],
      classroomId: '22222222-2222-4222-8222-222222222222',
      billing: { branchId: '33333333-3333-4333-8333-333333333333', startDate: '2026-09-15', feeIds: [] },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.child.create).not.toHaveBeenCalled();
    expect(tx.child.create).toHaveBeenCalledTimes(1);
    expect(usersService.createDirectly).toHaveBeenCalledWith(
      schoolId,
      expect.objectContaining({ email: 'sara@example.dz', role: 'parent' }),
      tx,
    );
    expect(tx.parentChildLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ childId: 'child-1', parentUserId: 'new-parent', relationship: 'mother' }) }),
    );
    expect(tx.emergencyContact.create).toHaveBeenCalledTimes(2);
    expect(tx.medicalNote.create).toHaveBeenCalledTimes(1);
    expect(tx.classroomEnrollment.create).toHaveBeenCalledTimes(1);
    expect(enrollmentService.createInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ childId: 'child-1', academicYearId: yearId }),
    );
    expect(result).toEqual({ child, billing: { enrollmentId: 'enr-1' } });
  });

  it('links an existing parent without creating an account', async () => {
    await childrenService.register(schoolId, {
      ...baseInput,
      parent: { relationship: 'father', parentUserId: '44444444-4444-4444-8444-444444444444' },
    });

    expect(usersService.createDirectly).not.toHaveBeenCalled();
    expect(tx.parentChildLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentUserId: '44444444-4444-4444-8444-444444444444' }) }),
    );
  });

  it('skips the optional parts when they are not given', async () => {
    const result = await childrenService.register(schoolId, baseInput);

    expect(tx.child.create).toHaveBeenCalledTimes(1);
    expect(tx.parentChildLink.create).not.toHaveBeenCalled();
    expect(tx.classroomEnrollment.create).not.toHaveBeenCalled();
    expect(enrollmentService.createInTransaction).not.toHaveBeenCalled();
    expect(result.billing).toBeNull();
  });

  it('fails the whole transaction when a later step fails (full classroom)', async () => {
    tx.classroomEnrollment.count.mockResolvedValue(20);

    await expect(
      childrenService.register(schoolId, {
        ...baseInput,
        emergencyContacts: [{ name: 'Omar', relationship: 'uncle', phone: '0555 12 34 56', isAuthorizedPickup: false }],
        classroomId: '22222222-2222-4222-8222-222222222222',
        billing: { branchId: '33333333-3333-4333-8333-333333333333', startDate: '2026-09-15', feeIds: [] },
      }),
    ).rejects.toThrow(/full capacity/);

    // The error leaves the transaction callback, so Prisma rolls back the child and contact.
    expect(tx.child.create).toHaveBeenCalledTimes(1);
    expect(enrollmentService.createInTransaction).not.toHaveBeenCalled();
  });

  it('refuses billing on a branch of another school', async () => {
    tx.branch.findFirst.mockResolvedValue(null);

    await expect(
      childrenService.register(schoolId, {
        ...baseInput,
        billing: { branchId: '33333333-3333-4333-8333-333333333333', startDate: '2026-09-15', feeIds: [] },
      }),
    ).rejects.toBeInstanceOf(ChildServiceError);
    expect(tx.branch.findFirst).toHaveBeenCalledWith({
      where: { id: '33333333-3333-4333-8333-333333333333', schoolId },
    });
    expect(enrollmentService.createInTransaction).not.toHaveBeenCalled();
  });

  it('fails the whole transaction when the new parent email is taken', async () => {
    vi.mocked(usersService.createDirectly).mockRejectedValue(new Error('A user with this email already exists'));

    await expect(
      childrenService.register(schoolId, {
        ...baseInput,
        parent: { relationship: 'mother', newParent: { firstName: 'Sara', lastName: 'Saidi', email: 'taken@example.dz' } },
      }),
    ).rejects.toThrow(/already exists/);
    expect(tx.parentChildLink.create).not.toHaveBeenCalled();
  });
});
