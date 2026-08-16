import { ContractType } from '@prisma/client';

export interface CreateStaffProfileInput {
  userId: string;
  position: string;
  contractType: ContractType;
  contractStart: string;
  contractEnd?: string;
}

export interface UpdateStaffProfileInput {
  position?: string;
  contractType?: ContractType;
  contractStart?: string;
  contractEnd?: string | null;
}

export interface StaffProfileResponse {
  id: string;
  userId: string;
  schoolId: string;
  position: string;
  contractType: ContractType;
  contractStart: Date;
  contractEnd: Date | null;
  documentPublicId: string | null;
  documentFormat: string | null;
  createdAt: Date;
}
