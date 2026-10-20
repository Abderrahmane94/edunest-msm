import { SchoolType } from '@prisma/client';

export interface CreateSchoolInput {
  name: string;
  address: string;
  wilaya: string;
  contactEmail: string;
  contactPhone: string;
  director: {
    firstName: string;
    lastName: string;
    /** One of the two: the director signs in with the email, or the phone when there is none. */
    email?: string;
    phone?: string;
    preferredLanguage?: string;
  };
  /** On trial for this many days: closed after, until it subscribes. */
  trialDays?: number;
}

export interface UpdateSchoolInput {
  name?: string;
  address?: string;
  wilaya?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface SchoolResponse {
  id: string;
  name: string;
  schoolType: SchoolType;
  address: string;
  wilaya: string;
  logoPublicId: string | null;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  /** On trial until then; null once subscribed (and for every school that never was). */
  trialEndsAt?: Date | null;
  demoExpiresAt?: Date | null;
  createdAt: Date;
}
