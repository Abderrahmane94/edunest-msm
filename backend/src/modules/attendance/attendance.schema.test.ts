import { describe, it, expect } from 'vitest';
import {
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  classroomAttendanceQuerySchema,
  childAttendanceQuerySchema,
  attendanceReportQuerySchema,
} from './attendance.schema';

describe('Attendance Schemas', () => {
  describe('bulkMarkAttendanceSchema', () => {
    it('should validate a correct bulk mark request', () => {
      const input = {
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-03-15',
        records: [
          { childId: '550e8400-e29b-41d4-a716-446655440001', status: 'present' },
          { childId: '550e8400-e29b-41d4-a716-446655440002', status: 'absent', note: 'Sick' },
          { childId: '550e8400-e29b-41d4-a716-446655440003', status: 'late' },
        ],
      };

      const result = bulkMarkAttendanceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const input = {
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
        date: '15-03-2024',
        records: [
          { childId: '550e8400-e29b-41d4-a716-446655440001', status: 'present' },
        ],
      };

      const result = bulkMarkAttendanceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status values', () => {
      const input = {
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-03-15',
        records: [
          { childId: '550e8400-e29b-41d4-a716-446655440001', status: 'excused' },
        ],
      };

      const result = bulkMarkAttendanceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty records array', () => {
      const input = {
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-03-15',
        records: [],
      };

      const result = bulkMarkAttendanceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID for classroomId', () => {
      const input = {
        classroomId: 'not-a-uuid',
        date: '2024-03-15',
        records: [
          { childId: '550e8400-e29b-41d4-a716-446655440001', status: 'present' },
        ],
      };

      const result = bulkMarkAttendanceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow optional note field', () => {
      const input = {
        classroomId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2024-03-15',
        records: [
          { childId: '550e8400-e29b-41d4-a716-446655440001', status: 'present' },
        ],
      };

      const result = bulkMarkAttendanceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('updateAttendanceSchema', () => {
    it('should validate a correct update request', () => {
      const input = { status: 'late', note: 'Arrived 10 minutes late' };
      const result = updateAttendanceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate without optional note', () => {
      const input = { status: 'present' };
      const result = updateAttendanceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const input = { status: 'excused' };
      const result = updateAttendanceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('classroomAttendanceQuerySchema', () => {
    it('should validate a correct date query', () => {
      const input = { date: '2024-03-15' };
      const result = classroomAttendanceQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const input = { date: 'March 15, 2024' };
      const result = classroomAttendanceQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('childAttendanceQuerySchema', () => {
    it('should validate with all optional fields', () => {
      const input = {
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        page: '2',
        pageSize: '10',
      };
      const result = childAttendanceQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(10);
      }
    });

    it('should provide defaults for page and pageSize', () => {
      const input = {};
      const result = childAttendanceQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it('should reject pageSize over 100', () => {
      const input = { pageSize: '200' };
      const result = childAttendanceQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('attendanceReportQuerySchema', () => {
    it('should validate correct month and year', () => {
      const input = { month: '3', year: '2025' };
      const result = attendanceReportQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.month).toBe(3);
        expect(result.data.year).toBe(2025);
      }
    });

    it('should reject month below 1', () => {
      const input = { month: '0', year: '2025' };
      const result = attendanceReportQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject month above 12', () => {
      const input = { month: '13', year: '2025' };
      const result = attendanceReportQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject year below 2000', () => {
      const input = { month: '3', year: '1999' };
      const result = attendanceReportQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept boundary values (month 1 and 12)', () => {
      const result1 = attendanceReportQuerySchema.safeParse({ month: '1', year: '2025' });
      expect(result1.success).toBe(true);

      const result12 = attendanceReportQuerySchema.safeParse({ month: '12', year: '2025' });
      expect(result12.success).toBe(true);
    });

    it('should reject non-numeric month', () => {
      const input = { month: 'march', year: '2025' };
      const result = attendanceReportQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
