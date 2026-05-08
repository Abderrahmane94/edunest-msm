export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface AcademicYearResponse {
  id: string;
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
}
