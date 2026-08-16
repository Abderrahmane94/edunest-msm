import { Gender, LearnerType } from '@prisma/client';

export interface ChildResponse {
  id: string;
  schoolId: string;
  academicYearId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  photoPublicId: string | null;
  enrollmentDate: Date;
  learnerType: LearnerType;
  isActive: boolean;
  createdAt: Date;
}

export interface ChildWithEnrollments extends ChildResponse {
  enrollments: {
    id: string;
    classroomId: string;
    enrolledAt: Date;
    classroom: {
      id: string;
      name: string;
      level: string | null;
    };
  }[];
  /** Only populated by list() — the detail page fetches parent links separately. */
  parentNames?: string[];
}

export interface ClassroomEnrollmentResponse {
  id: string;
  childId: string;
  classroomId: string;
  enrolledAt: Date;
  classroom: {
    id: string;
    name: string;
    level: string | null;
    academicYearId: string;
  };
}

export interface PhotoUrlResponse {
  url: string;
  expiresIn: number;
}

export interface ParentChildLinkResponse {
  id: string;
  childId: string;
  parentUserId: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: Date;
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface EmergencyContactResponse {
  id: string;
  childId: string;
  name: string;
  relationship: string;
  phone: string;
  isAuthorizedPickup: boolean;
  createdAt: Date;
}
