import prisma, { type DbClient } from '../../lib/prisma';
import { teacherClassroomIds } from '../substitutions/teaching-access';
import { unpaidByYear, type YearUnpaid } from '../payments/unpaid-by-year';
import { cloudinaryService } from '../../services/cloudinary.service';
import { softDeleteService } from '../../services/soft-delete.service';
import { usersService } from '../users/users.service';
import { enrollmentService } from '../payments/enrollment.service';
import type { EnrollmentGenerationResult } from '../payments/payments.types';
import type { RegisterChildInput, CreateChildInput, UpdateChildInput, EnrollChildInput, CreateParentLinkInput, UpdateParentLinkInput, CreateEmergencyContactInput, UpdateEmergencyContactInput, CreateMedicalNoteInput, UpdateMedicalNoteInput } from './children.schema';
import type { ChildWithEnrollments, ClassroomEnrollmentResponse, PhotoUrlResponse, ParentChildLinkResponse, EmergencyContactResponse, MedicalNoteResponse } from './children.types';

export class ChildServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ChildServiceError';
  }
}

const enrollmentInclude = {
  enrollments: {
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          level: true,
        },
      },
    },
  },
};

class ChildrenService {
  /**
   * Register a child with everything the creation wizard collected — parent
   * (existing or new account), emergency contacts, medical notes, classroom and
   * billing enrollment — in one transaction: if any part fails, nothing is saved.
   */
  async register(
    schoolId: string,
    input: RegisterChildInput,
  ): Promise<{ child: ChildWithEnrollments; billing: EnrollmentGenerationResult | null }> {
    return prisma.$transaction(
      async (tx) => {
        const child = await this.create(schoolId, input.child, tx);

        if (input.parent) {
          const { relationship, newParent } = input.parent;
          let parentUserId = input.parent.parentUserId;
          if (newParent) {
            const user = await usersService.createDirectly(
              schoolId,
              { ...newParent, role: 'parent', preferredLanguage: 'fr' },
              tx,
            );
            parentUserId = user.id;
          }
          await this.createParentLink(child.id, schoolId, { parentUserId: parentUserId!, relationship }, tx);
        }

        for (const contact of input.emergencyContacts) {
          await this.addEmergencyContact(child.id, schoolId, contact, tx);
        }
        for (const note of input.medicalNotes) {
          await this.addMedicalNote(child.id, schoolId, note, tx);
        }
        if (input.classroomId) {
          await this.enrollInClassroom(child.id, schoolId, { classroomId: input.classroomId }, tx);
        }

        let billing: EnrollmentGenerationResult | null = null;
        if (input.billing) {
          const branch = await tx.branch.findFirst({ where: { id: input.billing.branchId, schoolId } });
          if (!branch) {
            throw new ChildServiceError('Branch not found or does not belong to this school', 404);
          }
          billing = await enrollmentService.createInTransaction(tx, {
            childId: child.id,
            branchId: input.billing.branchId,
            academicYearId: input.child.academicYearId,
            startDate: new Date(input.billing.startDate),
            feeIds: input.billing.feeIds,
          });
        }

        return { child, billing };
      },
      // Many small writes against a remote database: the 5 s default is too tight.
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  /**
   * Register a new child for a school.
   * Validates that the academic year belongs to the same school.
   * Defaults learnerType to "child".
   */
  async create(schoolId: string, input: CreateChildInput, db: DbClient = prisma): Promise<ChildWithEnrollments> {
    // Validate academic year belongs to the same school
    const academicYear = await db.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
    });

    if (!academicYear) {
      throw new ChildServiceError('Academic year not found or does not belong to this school', 404);
    }

    const child = await db.child.create({
      data: {
        schoolId,
        academicYearId: input.academicYearId,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: new Date(input.dateOfBirth),
        gender: input.gender,
        enrollmentDate: new Date(input.enrollmentDate),
        learnerType: 'child',
        isActive: true,
        nationalId: input.nationalId,
        address: input.address,
        placeOfBirth: input.placeOfBirth,
        bloodType: input.bloodType,
      },
      include: enrollmentInclude,
    });

    return child;
  }

  /**
   * List all children for a school with pagination.
   * Soft-deleted records are automatically excluded by the Prisma extension.
   */
  async list(
    schoolId: string,
    page: number,
    pageSize: number,
    filters: ChildListFilters = {},
  ): Promise<{ children: ChildWithEnrollments[]; total: number }> {
    const where: Record<string, unknown> = { schoolId };
    const and: Record<string, unknown>[] = [];

    // Filter by classroom enrollment if classroom_id is provided
    if (filters.classroomId) {
      where.enrollments = { some: { classroomId: filters.classroomId } };
    }

    // A year's children: registered that year, or placed in one of its classes,
    // or enrolled for its billing.
    if (filters.academicYearId) {
      and.push({
        OR: [
          { academicYearId: filters.academicYearId },
          { enrollments: { some: { classroom: { academicYearId: filters.academicYearId } } } },
          { paymentEnrollments: { some: { academicYearId: filters.academicYearId } } },
        ],
      });
    }

    // Each word must match the child's first or last name, or a linked
    // parent's — so "yasmine boud" finds Yasmine Boudiaf.
    for (const word of (filters.search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
      const contains = { contains: word, mode: 'insensitive' };
      and.push({
        OR: [
          { firstName: contains },
          { lastName: contains },
          { parentLinks: { some: { parent: { OR: [{ firstName: contains }, { lastName: contains }] } } } },
        ],
      });
    }

    if (filters.gender) where.gender = filters.gender;
    if (filters.hasParent === true) where.parentLinks = { some: {} };
    if (filters.hasParent === false) where.parentLinks = { none: {} };
    if (filters.status) where.isActive = filters.status === 'active';
    if (and.length) where.AND = and;

    const [children, total] = await Promise.all([
      prisma.child.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          // Only that year's class when the list is limited to a year.
          enrollments: {
            ...(filters.academicYearId && { where: { classroom: { academicYearId: filters.academicYearId } } }),
            include: enrollmentInclude.enrollments.include,
          },
          parentLinks: {
            include: { parent: { select: { firstName: true, lastName: true } } },
          },
          emergencyContacts: true,
        },
      }),
      prisma.child.count({ where }),
    ]);

    const childrenWithParentNames = children.map(({ parentLinks, emergencyContacts, ...child }) => ({
      ...child,
      parentNames: parentLinks.map((link) => `${link.parent.firstName} ${link.parent.lastName}`),
      hasAuthorizedPickup:
        parentLinks.some((link) => link.canPickup) ||
        emergencyContacts.some((contact) => contact.isAuthorizedPickup),
    }));

    return { children: childrenWithParentNames, total };
  }

  /**
   * Get a single child by ID, scoped to the school.
   * When requestingParentUserId is provided, the child must also be linked to that parent.
   */
  async getById(
    id: string,
    schoolId: string,
    requestingParentUserId?: string,
    /** Only that school year's class in `enrollments`. */
    academicYearId?: string,
  ): Promise<
    ChildWithEnrollments & { schoolYears: { id: string; name: string }[]; unpaidOtherYears: YearUnpaid[] }
  > {
    const yearSelect = { select: { id: true, name: true, startDate: true } };
    const child = await prisma.child.findFirst({
      where: { id, schoolId },
      include: {
        enrollments: {
          include: {
            classroom: { select: { id: true, name: true, level: true, academicYear: yearSelect } },
          },
        },
        academicYear: yearSelect,
        paymentEnrollments: { select: { academicYear: yearSelect } },
      },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    if (requestingParentUserId) {
      await this.assertParentLinked(id, requestingParentUserId);
    }

    // The years the child was registered, placed in a class or billed, latest first.
    const years = new Map<string, { id: string; name: string; startDate: Date }>();
    for (const y of [
      child.academicYear,
      ...child.enrollments.map((e) => e.classroom.academicYear),
      ...child.paymentEnrollments.map((e) => e.academicYear),
    ]) {
      years.set(y.id, y);
    }
    const schoolYears = [...years.values()]
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map(({ id: yearId, name }) => ({ id: yearId, name }));

    // What is still owed from the years before, shown on the year's file (staff only).
    const unpaidOtherYears =
      academicYearId && !requestingParentUserId
        ? ((await unpaidByYear([id], academicYearId)).get(id) ?? [])
        : [];

    const { academicYear: _registrationYear, paymentEnrollments: _billing, enrollments, ...rest } = child;
    return {
      ...rest,
      enrollments: enrollments
        .filter((e) => !academicYearId || e.classroom.academicYear.id === academicYearId)
        .map(({ classroom: { academicYear, ...classroom }, ...e }) => ({ ...e, classroom })),
      schoolYears,
      unpaidOtherYears,
    };
  }

  /**
   * Throws if the given parent user is not linked to the given child.
   */
  private async assertParentLinked(childId: string, parentUserId: string): Promise<void> {
    const link = await prisma.parentChildLink.findUnique({
      where: { childId_parentUserId: { childId, parentUserId } },
    });

    if (!link) {
      throw new ChildServiceError('Child not found', 404);
    }
  }

  /**
   * Update a child record. Only updates provided fields.
   * learnerType is not changeable by the user.
   */
  async update(id: string, schoolId: string, input: UpdateChildInput): Promise<ChildWithEnrollments> {
    const child = await prisma.child.findFirst({
      where: { id, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // If academicYearId is being changed, validate it belongs to the school
    if (input.academicYearId) {
      const academicYear = await prisma.academicYear.findFirst({
        where: { id: input.academicYearId, schoolId },
      });

      if (!academicYear) {
        throw new ChildServiceError('Academic year not found or does not belong to this school', 404);
      }
    }

    const updated = await prisma.child.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.dateOfBirth !== undefined && { dateOfBirth: new Date(input.dateOfBirth) }),
        ...(input.gender !== undefined && { gender: input.gender }),
        ...(input.enrollmentDate !== undefined && { enrollmentDate: new Date(input.enrollmentDate) }),
        ...(input.academicYearId !== undefined && { academicYearId: input.academicYearId }),
        ...(input.nationalId !== undefined && { nationalId: input.nationalId }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.placeOfBirth !== undefined && { placeOfBirth: input.placeOfBirth }),
        ...(input.bloodType !== undefined && { bloodType: input.bloodType }),
      },
      include: enrollmentInclude,
    });

    return updated;
  }

  /**
   * Soft delete a child by setting deletedAt timestamp.
   * Delegates to the shared SoftDeleteService.
   */
  async softDelete(id: string, schoolId: string): Promise<void> {
    await softDeleteService.softDelete('child', id, schoolId);
  }

  /**
   * Enroll a child in a classroom.
   * Enforces:
   * 1. The classroom must belong to the same school as the child.
   * 2. The child can only have one enrollment per academic year — enrolling
   *    into another classroom of the same year transfers the existing one.
   */
  async enrollInClassroom(
    childId: string,
    schoolId: string,
    input: EnrollChildInput,
    db: DbClient = prisma,
  ): Promise<ClassroomEnrollmentResponse> {
    // Verify child exists and belongs to the school
    // Soft-deleted records are automatically excluded by the Prisma extension
    const child = await db.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify classroom exists and belongs to the same school
    const classroom = await db.classroom.findFirst({
      where: { id: input.classroomId, schoolId },
    });

    if (!classroom) {
      throw new ChildServiceError('Classroom not found or does not belong to this school', 404);
    }

    // Enforce one classroom per academic year:
    // Check if the child already has an enrollment in any classroom for the same academic year
    const existingEnrollment = await db.classroomEnrollment.findFirst({
      where: {
        childId,
        classroom: {
          academicYearId: classroom.academicYearId,
        },
      },
      include: {
        classroom: {
          select: { name: true, academicYearId: true },
        },
      },
    });

    if (existingEnrollment?.classroomId === input.classroomId) {
      throw new ChildServiceError(
        `Child is already enrolled in classroom "${existingEnrollment.classroom.name}".`,
        409,
      );
    }

    // Enforce classroom capacity
    const enrollmentCount = await db.classroomEnrollment.count({
      where: { classroomId: input.classroomId },
    });

    if (enrollmentCount >= classroom.capacity) {
      throw new ChildServiceError(
        `Classroom "${classroom.name}" is at full capacity (${classroom.capacity}).`,
        409,
      );
    }

    const enrollmentResponseInclude = {
      classroom: {
        select: {
          id: true,
          name: true,
          level: true,
          academicYearId: true,
        },
      },
    } as const;

    // Already enrolled in another classroom for this academic year: transfer
    // the existing enrollment instead of creating a second one.
    if (existingEnrollment) {
      return db.classroomEnrollment.update({
        where: { id: existingEnrollment.id },
        data: { classroomId: input.classroomId, enrolledAt: new Date() },
        include: enrollmentResponseInclude,
      });
    }

    // Create the enrollment
    const enrollment = await db.classroomEnrollment.create({
      data: {
        childId,
        classroomId: input.classroomId,
      },
      include: enrollmentResponseInclude,
    });

    return enrollment;
  }

  /**
   * Upload a child's photo to Cloudinary.
   * Stores the photo with authenticated access.
   */
  async uploadPhoto(childId: string, schoolId: string, file: Buffer): Promise<ChildWithEnrollments> {
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // If there's an existing photo, delete it
    if (child.photoPublicId) {
      await cloudinaryService.deleteFile(child.photoPublicId);
    }

    // Upload new photo
    const result = await cloudinaryService.uploadFile(file, {
      folder: `schools/${schoolId}/children`,
      resourceType: 'image',
      accessMode: 'authenticated',
    });

    // Update child record with new photo public_id
    const updated = await prisma.child.update({
      where: { id: childId },
      data: { photoPublicId: result.publicId },
      include: enrollmentInclude,
    });

    return updated;
  }

  /**
   * Generate a signed URL for a child's photo with 1-hour expiry.
   */
  getPhotoUrl(childId: string, schoolId: string, requestingParentUserId?: string): Promise<PhotoUrlResponse> {
    return this.getPhotoUrlInternal(childId, schoolId, requestingParentUserId);
  }

  private async getPhotoUrlInternal(childId: string, schoolId: string, requestingParentUserId?: string): Promise<PhotoUrlResponse> {
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    if (requestingParentUserId) {
      await this.assertParentLinked(childId, requestingParentUserId);
    }

    if (!child.photoPublicId) {
      throw new ChildServiceError('Child does not have a photo', 404);
    }

    const url = cloudinaryService.generateSignedUrl(child.photoPublicId, 'photo');

    return {
      url,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  /**
   * Create a parent-child link.
   * Enforces:
   * 1. Maximum 2 parent links per child
   * 2. Parent user must exist and belong to the same school with role 'parent'
   * 3. Unique constraint on [childId, parentUserId]
   */
  async createParentLink(
    childId: string,
    schoolId: string,
    input: CreateParentLinkInput,
    db: DbClient = prisma,
  ): Promise<ParentChildLinkResponse> {
    // Verify child exists and belongs to the school
    const child = await db.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify parent user exists, belongs to the same school, and has role 'parent'
    const parentUser = await db.user.findFirst({
      where: { id: input.parentUserId, schoolId, role: 'parent', isActive: true },
    });

    if (!parentUser) {
      throw new ChildServiceError('Parent user not found or does not belong to this school with parent role', 404);
    }

    // Check maximum 2 parent links per child
    const existingLinksCount = await db.parentChildLink.count({
      where: { childId },
    });

    if (existingLinksCount >= 2) {
      throw new ChildServiceError('Maximum of 2 parent links per child has been reached', 409);
    }

    // Check for duplicate link (unique constraint)
    const existingLink = await db.parentChildLink.findUnique({
      where: { childId_parentUserId: { childId, parentUserId: input.parentUserId } },
    });

    if (existingLink) {
      throw new ChildServiceError('This parent is already linked to this child', 409);
    }

    // Create the link
    const link = await db.parentChildLink.create({
      data: {
        childId,
        parentUserId: input.parentUserId,
        relationship: input.relationship,
        isPrimary: false,
        canPickup: input.canPickup ?? true,
      },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return link;
  }

  /**
   * List all parent links for a child, scoped to the school.
   */
  async getParentLinks(childId: string, schoolId: string): Promise<ParentChildLinkResponse[]> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    const links = await prisma.parentChildLink.findMany({
      where: { childId },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return links;
  }

  /**
   * Update a parent-child link's relationship.
   */
  async updateParentLink(
    childId: string,
    schoolId: string,
    linkId: string,
    input: UpdateParentLinkInput,
  ): Promise<ParentChildLinkResponse> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify the link exists and belongs to this child
    const link = await prisma.parentChildLink.findFirst({
      where: { id: linkId, childId },
    });

    if (!link) {
      throw new ChildServiceError('Parent-child link not found', 404);
    }

    const updated = await prisma.parentChildLink.update({
      where: { id: linkId },
      data: {
        relationship: input.relationship,
        ...(input.canPickup !== undefined && { canPickup: input.canPickup }),
      },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Remove a parent-child link.
   */
  async removeParentLink(childId: string, schoolId: string, linkId: string): Promise<void> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify the link exists and belongs to this child
    const link = await prisma.parentChildLink.findFirst({
      where: { id: linkId, childId },
    });

    if (!link) {
      throw new ChildServiceError('Parent-child link not found', 404);
    }

    await prisma.parentChildLink.delete({
      where: { id: linkId },
    });
  }

  /**
   * Set a parent-child link as primary.
   * Unsets any other primary link for the same child.
   */
  async setPrimaryLink(childId: string, schoolId: string, linkId: string): Promise<ParentChildLinkResponse> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify the link exists and belongs to this child
    const link = await prisma.parentChildLink.findFirst({
      where: { id: linkId, childId },
    });

    if (!link) {
      throw new ChildServiceError('Parent-child link not found', 404);
    }

    // Use a transaction to unset other primary links and set this one
    const updatedLink = await prisma.$transaction(async (tx) => {
      // Unset all primary links for this child
      await tx.parentChildLink.updateMany({
        where: { childId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set the specified link as primary
      return tx.parentChildLink.update({
        where: { id: linkId },
        data: { isPrimary: true },
        include: {
          parent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    return updatedLink;
  }

  // ─── Emergency Contacts ──────────────────────────────────────────────────────

  /**
   * Add an emergency contact for a child.
   * Validates that the child exists and belongs to the school.
   */
  async addEmergencyContact(
    childId: string,
    schoolId: string,
    input: CreateEmergencyContactInput,
    db: DbClient = prisma,
  ): Promise<EmergencyContactResponse> {
    // Verify child exists and belongs to the school
    const child = await db.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    const contact = await db.emergencyContact.create({
      data: {
        childId,
        name: input.name,
        relationship: input.relationship,
        phone: input.phone,
        address: input.address,
        nationalId: input.nationalId,
        isAuthorizedPickup: input.isAuthorizedPickup ?? false,
      },
    });

    return contact;
  }

  /**
   * List all emergency contacts for a child, scoped to the school.
   */
  async getEmergencyContacts(childId: string, schoolId: string): Promise<EmergencyContactResponse[]> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    const contacts = await prisma.emergencyContact.findMany({
      where: { childId },
      orderBy: { createdAt: 'asc' },
    });

    return contacts;
  }

  /**
   * Update an emergency contact. Only updates provided fields.
   */
  async updateEmergencyContact(
    childId: string,
    schoolId: string,
    contactId: string,
    input: UpdateEmergencyContactInput,
  ): Promise<EmergencyContactResponse> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify the contact exists and belongs to this child
    const contact = await prisma.emergencyContact.findFirst({
      where: { id: contactId, childId },
    });

    if (!contact) {
      throw new ChildServiceError('Emergency contact not found', 404);
    }

    const updated = await prisma.emergencyContact.update({
      where: { id: contactId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.relationship !== undefined && { relationship: input.relationship }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.nationalId !== undefined && { nationalId: input.nationalId }),
        ...(input.isAuthorizedPickup !== undefined && { isAuthorizedPickup: input.isAuthorizedPickup }),
      },
    });

    return updated;
  }

  /**
   * Remove an emergency contact.
   */
  async removeEmergencyContact(childId: string, schoolId: string, contactId: string): Promise<void> {
    // Verify child exists and belongs to the school
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    // Verify the contact exists and belongs to this child
    const contact = await prisma.emergencyContact.findFirst({
      where: { id: contactId, childId },
    });

    if (!contact) {
      throw new ChildServiceError('Emergency contact not found', 404);
    }

    await prisma.emergencyContact.delete({
      where: { id: contactId },
    });
  }

  // ─── Medical Notes ────────────────────────────────────────────────────────

  /**
   * Add a medical note (allergy, condition, or medication) for a child.
   */
  async addMedicalNote(
    childId: string,
    schoolId: string,
    input: CreateMedicalNoteInput,
    db: DbClient = prisma,
  ): Promise<MedicalNoteResponse> {
    const child = await db.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    const note = await db.medicalNote.create({
      data: {
        childId,
        type: input.type,
        title: input.title,
        details: input.details,
        severity: input.severity,
      },
    });
    return note;
  }

  /**
   * List all medical notes for a child, scoped to the school. Teachers may
   * only view notes for children enrolled in their own classroom.
   */
  async getMedicalNotes(
    childId: string,
    schoolId: string,
    requestingTeacherUserId?: string,
  ): Promise<MedicalNoteResponse[]> {
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    if (requestingTeacherUserId) {
      const enrollment = await prisma.classroomEnrollment.findFirst({
        where: { childId, classroomId: { in: await teacherClassroomIds(requestingTeacherUserId, schoolId) } },
      });
      if (!enrollment) {
        throw new ChildServiceError('This child is not in your assigned classroom', 403);
      }
    }

    const notes = await prisma.medicalNote.findMany({
      where: { childId },
      orderBy: { createdAt: 'desc' },
    });
    return notes;
  }

  /**
   * Update a medical note. Only updates provided fields.
   */
  async updateMedicalNote(
    childId: string,
    schoolId: string,
    noteId: string,
    input: UpdateMedicalNoteInput,
  ): Promise<MedicalNoteResponse> {
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    const note = await prisma.medicalNote.findFirst({
      where: { id: noteId, childId },
    });

    if (!note) {
      throw new ChildServiceError('Medical note not found', 404);
    }

    const updated = await prisma.medicalNote.update({
      where: { id: noteId },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.details !== undefined && { details: input.details }),
        ...(input.severity !== undefined && { severity: input.severity }),
      },
    });
    return updated;
  }

  /**
   * Remove a medical note.
   */
  async removeMedicalNote(childId: string, schoolId: string, noteId: string): Promise<void> {
    const child = await prisma.child.findFirst({
      where: { id: childId, schoolId },
    });

    if (!child) {
      throw new ChildServiceError('Child not found', 404);
    }

    const note = await prisma.medicalNote.findFirst({
      where: { id: noteId, childId },
    });

    if (!note) {
      throw new ChildServiceError('Medical note not found', 404);
    }

    await prisma.medicalNote.delete({
      where: { id: noteId },
    });
  }
}

export interface ChildListFilters {
  classroomId?: string;
  /** Children of one school year. */
  academicYearId?: string;
  /** Words matched against the child's and linked parents' names. */
  search?: string;
  gender?: 'male' | 'female';
  /** true: has a linked parent account; false: has none. */
  hasParent?: boolean;
  status?: 'active' | 'inactive';
}

export const childrenService = new ChildrenService();
