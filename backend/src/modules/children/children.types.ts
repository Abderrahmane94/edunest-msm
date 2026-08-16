import { Gender, LearnerType, BloodType, MedicalNoteType, Severity } from '@prisma/client';

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
  nationalId: string | null;
  address: string | null;
  placeOfBirth: string | null;
  bloodType: BloodType | null;
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
  /** Only populated by list() — true if any linked parent or emergency contact can pick up the child. */
  hasAuthorizedPickup?: boolean;
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
  canPickup: boolean;
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
  address: string | null;
  nationalId: string | null;
  isAuthorizedPickup: boolean;
  createdAt: Date;
}

export interface MedicalNoteResponse {
  id: string;
  childId: string;
  type: MedicalNoteType;
  title: string;
  details: string | null;
  severity: Severity;
  createdAt: Date;
}
