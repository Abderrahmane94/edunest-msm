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
  createdAt: Date;
}
