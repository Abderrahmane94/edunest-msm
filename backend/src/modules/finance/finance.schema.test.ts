import { describe, it, expect } from 'vitest';
import { createFeeStructureSchema, updateFeeStructureSchema, createInvoiceSchema, bulkGenerateInvoicesSchema, recordCashPaymentSchema, createDiscountSchema, updateDiscountSchema } from './finance.schema';

describe('createInvoiceSchema', () => {
  it('should validate a complete valid input', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440002',
      amount: 15000,
      dueDate: '2024-06-15',
    };

    const result = createInvoiceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID for childId', () => {
    const input = {
      childId: 'not-a-uuid',
      parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440002',
      amount: 15000,
      dueDate: '2024-06-15',
    };

    const result = createInvoiceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative amount', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440002',
      amount: -100,
      dueDate: '2024-06-15',
    };

    const result = createInvoiceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject zero amount', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440002',
      amount: 0,
      dueDate: '2024-06-15',
    };

    const result = createInvoiceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440002',
      amount: 15000,
      dueDate: '15/06/2024',
    };

    const result = createInvoiceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject amount exceeding maximum', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      parentUserId: '550e8400-e29b-41d4-a716-446655440001',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440002',
      amount: 100000000,
      dueDate: '2024-06-15',
    };

    const result = createInvoiceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('bulkGenerateInvoicesSchema', () => {
  it('should validate a complete valid input', () => {
    const input = {
      classroomId: '550e8400-e29b-41d4-a716-446655440000',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440001',
      amount: 15000,
      dueDate: '2024-06-15',
    };

    const result = bulkGenerateInvoicesSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID for classroomId', () => {
    const input = {
      classroomId: 'invalid',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440001',
      amount: 15000,
      dueDate: '2024-06-15',
    };

    const result = bulkGenerateInvoicesSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative amount', () => {
    const input = {
      classroomId: '550e8400-e29b-41d4-a716-446655440000',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440001',
      amount: -500,
      dueDate: '2024-06-15',
    };

    const result = bulkGenerateInvoicesSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const input = {
      classroomId: '550e8400-e29b-41d4-a716-446655440000',
      feeStructureId: '550e8400-e29b-41d4-a716-446655440001',
      amount: 15000,
      dueDate: '2024/06/15',
    };

    const result = bulkGenerateInvoicesSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('createFeeStructureSchema', () => {
  it('should validate a complete valid input', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Monthly Tuition',
      amount: 15000,
      currency: 'DZD',
      frequency: 'monthly',
      level: 'petite section',
      description: 'Monthly tuition fee for petite section',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should default currency to DZD when not provided', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Annual Fee',
      amount: 120000,
      frequency: 'annual',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('DZD');
    }
  });

  it('should reject invalid frequency values', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Fee',
      amount: 5000,
      frequency: 'weekly',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept all valid frequency values', () => {
    const frequencies = ['monthly', 'quarterly', 'annual', 'one_time'];

    for (const frequency of frequencies) {
      const input = {
        academicYearId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Fee',
        amount: 5000,
        frequency,
      };

      const result = createFeeStructureSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('should reject non-DZD currency', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Fee',
      amount: 5000,
      currency: 'USD',
      frequency: 'monthly',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative amount', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Fee',
      amount: -100,
      frequency: 'monthly',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject zero amount', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Fee',
      amount: 0,
      frequency: 'monthly',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
      amount: 5000,
      frequency: 'monthly',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for academicYearId', () => {
    const input = {
      academicYearId: 'not-a-uuid',
      name: 'Fee',
      amount: 5000,
      frequency: 'monthly',
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should allow nullable level and description', () => {
    const input = {
      academicYearId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Fee',
      amount: 5000,
      frequency: 'one_time',
      level: null,
      description: null,
    };

    const result = createFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('updateFeeStructureSchema', () => {
  it('should validate a partial update with only name', () => {
    const input = { name: 'Updated Fee Name' };
    const result = updateFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate a partial update with only amount', () => {
    const input = { amount: 20000 };
    const result = updateFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate an empty object (no fields to update)', () => {
    const input = {};
    const result = updateFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid frequency in update', () => {
    const input = { frequency: 'biweekly' };
    const result = updateFeeStructureSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('recordCashPaymentSchema', () => {
  it('should validate a complete valid input', () => {
    const input = {
      amount_received: 5000,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
      note: 'Paid in cash at office',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate input without optional note', () => {
    const input = {
      amount_received: 15000,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept null note', () => {
    const input = {
      amount_received: 15000,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
      note: null,
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject negative amount_received', () => {
    const input = {
      amount_received: -100,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject zero amount_received', () => {
    const input = {
      amount_received: 0,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for received_by', () => {
    const input = {
      amount_received: 5000,
      received_by: 'not-a-uuid',
      received_at: '2024-06-15T10:30:00.000Z',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime for received_at', () => {
    const input = {
      amount_received: 5000,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject amount exceeding maximum', () => {
    const input = {
      amount_received: 100000000,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject note exceeding 1000 characters', () => {
    const input = {
      amount_received: 5000,
      received_by: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2024-06-15T10:30:00.000Z',
      note: 'a'.repeat(1001),
    };

    const result = recordCashPaymentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('createDiscountSchema', () => {
  it('should validate a complete valid input', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'scholarship',
      percentage: 25,
      description: 'Academic excellence',
      validFrom: '2024-09-01',
      validTo: '2025-06-30',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate input with null validTo (no expiry)', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'staff',
      percentage: 50,
      validFrom: '2024-01-01',
      validTo: null,
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate input without optional fields', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'sibling',
      percentage: 10,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject percentage of 0', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'custom',
      percentage: 0,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject percentage greater than 100', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'scholarship',
      percentage: 101,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept percentage of exactly 100', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'scholarship',
      percentage: 100,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject negative percentage', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'custom',
      percentage: -5,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid discount type', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'invalid_type',
      percentage: 10,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept all valid discount types', () => {
    const types = ['scholarship', 'sibling', 'staff', 'custom'];
    for (const type of types) {
      const input = {
        childId: '550e8400-e29b-41d4-a716-446655440000',
        type,
        percentage: 10,
        validFrom: '2024-01-01',
      };
      const result = createDiscountSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid date format for validFrom', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'scholarship',
      percentage: 10,
      validFrom: '2024/01/01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format for validTo', () => {
    const input = {
      childId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'scholarship',
      percentage: 10,
      validFrom: '2024-01-01',
      validTo: '2025/06/30',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for childId', () => {
    const input = {
      childId: 'not-a-uuid',
      type: 'scholarship',
      percentage: 10,
      validFrom: '2024-01-01',
    };

    const result = createDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('updateDiscountSchema', () => {
  it('should validate a partial update with only percentage', () => {
    const input = { percentage: 30 };
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate a partial update with only type', () => {
    const input = { type: 'sibling' };
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate an empty object (no fields to update)', () => {
    const input = {};
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid type in update', () => {
    const input = { type: 'invalid' };
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject percentage of 0 in update', () => {
    const input = { percentage: 0 };
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject percentage over 100 in update', () => {
    const input = { percentage: 150 };
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should allow setting validTo to null', () => {
    const input = { validTo: null };
    const result = updateDiscountSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
