import { UserRole, Language } from '@prisma/client';

export interface InviteUserInput {
  email: string;
  role: UserRole;
}

export interface RegisterUserInput {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UpdateFcmTokenInput {
  fcmToken: string;
}

export interface UpdateLanguageInput {
  preferredLanguage: Language;
}

export interface UserResponse {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  fcmToken: string | null;
  preferredLanguage: Language;
  createdAt: Date;
}

export interface InvitationInfo {
  email: string;
  role: UserRole;
  schoolId: string;
}
