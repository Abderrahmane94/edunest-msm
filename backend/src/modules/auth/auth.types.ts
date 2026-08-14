import { UserRole } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  schoolId: string | null;
  branchId?: string | null;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface LoginSchoolOption {
  schoolId: string | null;
  schoolName: string | null;
}

/** Returned instead of LoginResponse when email+password match accounts in more than one school. */
export interface LoginChoiceRequired {
  choiceRequired: true;
  schools: LoginSchoolOption[];
}

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId: string | null;
  mustChangePassword: boolean;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface PasswordResetRequestResponse {
  message: string;
}

export interface PasswordResetConfirmResponse {
  message: string;
}
