export interface ClassroomResponse {
  id: string;
  schoolId: string;
  academicYearId: string;
  teacherUserId: string | null;
  name: string;
  capacity: number;
  roomNumber: string | null;
  level: string | null;
  createdAt: Date;
}

export interface ClassroomWithTeacher extends ClassroomResponse {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface CreateClassroomInput {
  name: string;
  capacity: number;
  roomNumber?: string;
  level?: string;
  academicYearId: string;
}

export interface UpdateClassroomInput {
  name?: string;
  capacity?: number;
  roomNumber?: string | null;
  level?: string | null;
}

export interface AssignTeacherInput {
  teacherUserId: string | null;
}
