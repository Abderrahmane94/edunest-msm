import { describe, it, expect } from 'vitest';
import { createAcademicYearSchema } from './academic-years.schema';

describe('createAcademicYearSchema', () => {
  it('should validate a correct input', () => {
    const input = { name: '2024-2025', startDate: '2024-09-01', endDate: '2025-06-30' };
    const result = createAcademicYearSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const input = { name: '', startDate: '2024-09-01', endDate: '2025-06-30' };
    const result = createAcademicYearSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format for startDate', () => {
    const input = { name: '2024-2025', startDate: '01/09/2024', endDate: '2025-06-30' };
    const result = createAcademicYearSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format for endDate', () => {
    const input = { name: '2024-2025', startDate: '2024-09-01', endDate: '30-06-2025' };
    const result = createAcademicYearSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject when endDate is before startDate', () => {
    const input = { name: '2024-2025', startDate: '2025-06-30', endDate: '2024-09-01' };
    const result = createAcademicYearSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('End date must be after start date');
    }
  });

  it('should reject when endDate equals startDate', () => {
    const input = { name: '2024-2025', startDate: '2024-09-01', endDate: '2024-09-01' };
    const result = createAcademicYearSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = createAcademicYearSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
