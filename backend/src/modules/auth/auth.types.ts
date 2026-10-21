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
  /** The person's role there (director, teacher, parent…). */
  role: UserRole;
}

/** Returned instead of LoginResponse when email+password match accounts in more than one school. */
export interface LoginChoiceRequired {
  choiceRequired: true;
  schools: LoginSchoolOption[];
}

export interface UserInfo {
  id: string;
  /** None for an account that signs in with its phone number. */
  email: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId: string | null;
  mustChangePassword: boolean;
  /**
   * Set when it must change a temporary password and the person has other
   * accounts (other schools, the platform): choosing their usual password
   * keeps one password for all.
   */
  hasOtherAccounts?: boolean;
}

export interface RefreshResponse {
  accessToken: string;
  /** Set when the session was extended: the client replaces its refresh token. */
  refreshToken?: string;
}

export interface PasswordResetRequestResponse {
  message: string;
}

export interface PasswordResetConfirmResponse {
  message: string;
}
