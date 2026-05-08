import { describe, it, expect } from 'vitest';
import { createChildSchema, updateChildSchema, enrollChildSchema, createParentLinkSchema, createEmergencyContactSchema, updateEmergencyContactSchema, emergencyContactParamsSchema } from './children.schema';

describe('Children Schemas', () => {
  describe('createChildSchema', () => {
    it('should validate a valid child registration input', () => {
      const input = {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '2019-05-15',
        gender: 'male',
        enrollmentDate: '2024-09-01',
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createChildSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const input = {
        firstName: 'Ahmed',
      };

      const result = createChildSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format for dateOfBirth', () => {
      const input = {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '15/05/2019',
        gender: 'male',
        enrollmentDate: '2024-09-01',
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createChildSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('YYYY-MM-DD');
      }
    });

    it('should reject invalid gender value', () => {
      const input = {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '2019-05-15',
        gender: 'other',
        enrollmentDate: '2024-09-01',
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createChildSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('male or female');
      }
    });

    it('should reject invalid UUID for academicYearId', () => {
      const input = {
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '2019-05-15',
        gender: 'male',
        enrollmentDate: '2024-09-01',
        academicYearId: 'not-a-uuid',
      };

      const result = createChildSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateChildSchema', () => {
    it('should validate partial updates', () => {
      const input = { firstName: 'Mohamed' };
      const result = updateChildSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate empty object (no updates)', () => {
      const result = updateChildSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const input = { dateOfBirth: 'invalid-date' };
      const result = updateChildSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('enrollChildSchema', () => {
    it('should validate a valid classroom ID', () => {
      const input = { classroomId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = enrollChildSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID for classroomId', () => {
      const input = { classroomId: 'not-a-uuid' };
      const result = enrollChildSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing classroomId', () => {
      const result = enrollChildSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('createParentLinkSchema', () => {
    it('should validate a valid parent link input', () => {
      const input = {
        parentUserId: '550e8400-e29b-41d4-a716-446655440000',
        relationship: 'mother',
      };
      const result = createParentLinkSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid relationship types', () => {
      const validRelationships = ['mother', 'father', 'guardian'];
      for (const relationship of validRelationships) {
        const input = {
          parentUserId: '550e8400-e29b-41d4-a716-446655440000',
          relationship,
        };
        const result = createParentLinkSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid relationship type', () => {
      const input = {
        parentUserId: '550e8400-e29b-41d4-a716-446655440000',
        relationship: 'uncle',
      };
      const result = createParentLinkSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID for parentUserId', () => {
      const input = {
        parentUserId: 'not-a-uuid',
        relationship: 'mother',
      };
      const result = createParentLinkSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = createParentLinkSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('createEmergencyContactSchema', () => {
    it('should validate a valid emergency contact input', () => {
      const input = {
        name: 'Uncle Omar',
        relationship: 'uncle',
        phone: '+213555123456',
        isAuthorizedPickup: true,
      };
      const result = createEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should default isAuthorizedPickup to false when not provided', () => {
      const input = {
        name: 'Aunt Khadija',
        relationship: 'aunt',
        phone: '+213555654321',
      };
      const result = createEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthorizedPickup).toBe(false);
      }
    });

    it('should reject missing required fields', () => {
      const result = createEmergencyContactSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        relationship: 'uncle',
        phone: '+213555123456',
      };
      const result = createEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean isAuthorizedPickup', () => {
      const input = {
        name: 'Uncle Omar',
        relationship: 'uncle',
        phone: '+213555123456',
        isAuthorizedPickup: 'yes',
      };
      const result = createEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateEmergencyContactSchema', () => {
    it('should validate partial updates', () => {
      const input = { name: 'New Name' };
      const result = updateEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate empty object (no updates)', () => {
      const result = updateEmergencyContactSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate updating isAuthorizedPickup only', () => {
      const input = { isAuthorizedPickup: true };
      const result = updateEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty name string', () => {
      const input = { name: '' };
      const result = updateEmergencyContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('emergencyContactParamsSchema', () => {
    it('should validate valid UUIDs for id and contactId', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        contactId: '660e8400-e29b-41d4-a716-446655440000',
      };
      const result = emergencyContactParamsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID for id', () => {
      const input = {
        id: 'not-a-uuid',
        contactId: '660e8400-e29b-41d4-a716-446655440000',
      };
      const result = emergencyContactParamsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID for contactId', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        contactId: 'not-a-uuid',
      };
      const result = emergencyContactParamsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
