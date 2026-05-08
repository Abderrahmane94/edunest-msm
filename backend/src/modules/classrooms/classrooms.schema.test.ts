import { describe, it, expect } from 'vitest';
import { createClassroomSchema, updateClassroomSchema, assignTeacherSchema } from './classrooms.schema';

describe('Classroom Schemas', () => {
  describe('createClassroomSchema', () => {
    it('should validate a valid create input', () => {
      const input = {
        name: 'Class A',
        capacity: 25,
        roomNumber: 'R101',
        level: 'KG1',
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept input without optional fields', () => {
      const input = {
        name: 'Class B',
        capacity: 20,
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        capacity: 25,
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject non-positive capacity', () => {
      const input = {
        name: 'Class A',
        capacity: 0,
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative capacity', () => {
      const input = {
        name: 'Class A',
        capacity: -5,
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer capacity', () => {
      const input = {
        name: 'Class A',
        capacity: 25.5,
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID for academicYearId', () => {
      const input = {
        name: 'Class A',
        capacity: 25,
        academicYearId: 'not-a-uuid',
      };

      const result = createClassroomSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateClassroomSchema', () => {
    it('should validate partial update with only name', () => {
      const input = { name: 'Updated Class' };
      const result = updateClassroomSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate partial update with only capacity', () => {
      const input = { capacity: 30 };
      const result = updateClassroomSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow null for roomNumber (to clear it)', () => {
      const input = { roomNumber: null };
      const result = updateClassroomSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject non-positive capacity in update', () => {
      const input = { capacity: 0 };
      const result = updateClassroomSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('assignTeacherSchema', () => {
    it('should validate a valid teacher UUID', () => {
      const input = { teacherUserId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = assignTeacherSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow null to unassign teacher', () => {
      const input = { teacherUserId: null };
      const result = assignTeacherSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const input = { teacherUserId: 'not-a-uuid' };
      const result = assignTeacherSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
