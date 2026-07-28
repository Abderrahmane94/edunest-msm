import { UserRole } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  schoolId: string | null;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
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
